import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

function getCryptoEngine(): pkijs.ICryptoEngine | null {
  try {
    return pkijs.getCrypto(true)
  } catch {
    return null
  }
}

export function isKeygenAvailable(): boolean {
  if (typeof btoa !== 'function') return false
  if (!globalThis.window?.crypto?.subtle) return false
  return !!getCryptoEngine()
}

function arrayBufferToPem(buffer: ArrayBuffer, type: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`
}

function extractPkcs8PrivateKeyDer(pkcs8Der: ArrayBuffer): ArrayBuffer {
  const pkcs8 = asn1js.fromBER(pkcs8Der)
  if (pkcs8.offset === -1 || !(pkcs8.result instanceof asn1js.Sequence)) {
    throw new Error('Invalid PKCS#8 structure')
  }

  const [, , privateKeyOctet] = pkcs8.result.valueBlock.value
  if (!(privateKeyOctet instanceof asn1js.OctetString)) {
    throw new Error('PKCS#8 missing privateKey OCTET STRING')
  }

  return privateKeyOctet.getValue()
}

function parsePkcs8(pkcs8Der: ArrayBuffer): { algorithmIdentifier: asn1js.Sequence; privateKeyOctet: asn1js.OctetString } {
  const pkcs8 = asn1js.fromBER(pkcs8Der)
  if (pkcs8.offset === -1 || !(pkcs8.result instanceof asn1js.Sequence)) {
    throw new Error('Invalid PKCS#8 structure')
  }

  const [, algorithmIdentifier, privateKeyOctet] = pkcs8.result.valueBlock.value
  if (!(algorithmIdentifier instanceof asn1js.Sequence) || !(privateKeyOctet instanceof asn1js.OctetString)) {
    throw new Error('Invalid PKCS#8 fields')
  }

  return { algorithmIdentifier, privateKeyOctet }
}

async function generateEcKeyPair(): Promise<CryptoKeyPair> {
  const cryptoEngine = getCryptoEngine()
  if (!cryptoEngine) throw new Error('WebCrypto engine is unavailable')
  const algorithm = pkijs.getAlgorithmParameters('ECDSA', 'generateKey') as {
    algorithm: EcKeyGenParams & { hash?: string }
    usages: KeyUsage[]
  }
  algorithm.algorithm.namedCurve = 'P-256'
  const keyPair = await cryptoEngine.generateKey(algorithm.algorithm, true, algorithm.usages)
  return keyPair as CryptoKeyPair
}

async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  const cryptoEngine = getCryptoEngine()
  if (!cryptoEngine) throw new Error('WebCrypto engine is unavailable')
  const algorithm = pkijs.getAlgorithmParameters('RSA-OAEP', 'generateKey') as {
    algorithm: RsaHashedKeyGenParams
    usages: KeyUsage[]
  }
  algorithm.algorithm.hash = 'SHA-256'
  const keyPair = await cryptoEngine.generateKey(algorithm.algorithm, true, algorithm.usages)
  return keyPair as CryptoKeyPair
}

async function exportEcPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey)
  const { algorithmIdentifier, privateKeyOctet } = parsePkcs8(exported)
  const sec1 = asn1js.fromBER(privateKeyOctet.getValue())
  if (sec1.offset === -1 || !(sec1.result instanceof asn1js.Sequence)) {
    throw new Error('Invalid ECPrivateKey structure')
  }

  const algorithmValues = algorithmIdentifier.valueBlock.value
  const curveOid = algorithmValues[1]
  const hasParameters = sec1.result.valueBlock.value.some(
    (node) => node instanceof asn1js.Constructed && node.idBlock.tagClass === 3 && node.idBlock.tagNumber === 0
  )

  if (!hasParameters && curveOid instanceof asn1js.ObjectIdentifier) {
    const publicKeyIndex = sec1.result.valueBlock.value.findIndex(
      (node) => node instanceof asn1js.Constructed && node.idBlock.tagClass === 3 && node.idBlock.tagNumber === 1
    )
    const parametersNode = new asn1js.Constructed({
      idBlock: { tagClass: 3, tagNumber: 0 },
      value: [new asn1js.ObjectIdentifier({ value: curveOid.valueBlock.toString() })]
    })

    if (publicKeyIndex >= 0) {
      sec1.result.valueBlock.value.splice(publicKeyIndex, 0, parametersNode)
    } else {
      sec1.result.valueBlock.value.push(parametersNode)
    }
  }

  const sec1Der = sec1.result.toBER(false)
  return arrayBufferToPem(sec1Der, 'EC PRIVATE KEY')
}

async function exportRsaPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey)
  const pkcs1Der = extractPkcs8PrivateKeyDer(exported)
  return arrayBufferToPem(pkcs1Der, 'RSA PRIVATE KEY')
}

async function generateCertificate(privateKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const publicKeyDer = await crypto.subtle.exportKey('spki', publicKey)

  const cert = new pkijs.Certificate()
  cert.version = 0
  cert.serialNumber = new asn1js.Integer({ value: 1 })

  const now = new Date()
  const tenYearsLater = new Date(now.getTime() + 3650 * 24 * 60 * 60 * 1000)

  cert.notBefore = new pkijs.Time({ type: 0, value: now })
  cert.notAfter = new pkijs.Time({ type: 0, value: tenYearsLater })

  cert.issuer.typesAndValues.push(new pkijs.AttributeTypeAndValue({
    type: '2.5.4.3',
    value: new asn1js.Utf8String({ value: 'Generated' })
  }))

  cert.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({
    type: '2.5.4.3',
    value: new asn1js.Utf8String({ value: 'Generated' })
  }))

  const publicKeyInfo = pkijs.PublicKeyInfo.fromBER(publicKeyDer)
  cert.subjectPublicKeyInfo = publicKeyInfo

  await cert.sign(privateKey, 'SHA-256')

  const certDer = cert.toSchema().toBER(false)

  return arrayBufferToPem(certDer, 'CERTIFICATE')
}

export async function generateUnknownKeybox(): Promise<string> {
  const ecKeyPair = await generateEcKeyPair()
  const ecPrivateKeyPem = await exportEcPrivateKey(ecKeyPair.privateKey)
  const certPem = await generateCertificate(ecKeyPair.privateKey, ecKeyPair.publicKey)

  const rsaKeyPair = await generateRsaKeyPair()
  const rsaPrivateKeyPem = await exportRsaPrivateKey(rsaKeyPair.privateKey)

  const keybox = `<?xml version="1.0" encoding="UTF-8"?>
<AndroidAttestation>
    <NumberOfKeyboxes>1</NumberOfKeyboxes>
    <Keybox DeviceID="sw">
        <Key algorithm="ecdsa">
            <PrivateKey format="pem">
${ecPrivateKeyPem.split('\n').map(line => '                ' + line).join('\n')}
            </PrivateKey>
            <CertificateChain>
                <NumberOfCertificates>1</NumberOfCertificates>
                <Certificate format="pem">
${certPem.split('\n').map(line => '                    ' + line).join('\n')}
                </Certificate>
            </CertificateChain>
        </Key>
        <Key algorithm="rsa">
            <PrivateKey format="pem">
${rsaPrivateKeyPem.split('\n').map(line => '                ' + line).join('\n')}
            </PrivateKey>
        </Key>
    </Keybox>
</AndroidAttestation>`

  return keybox
}
