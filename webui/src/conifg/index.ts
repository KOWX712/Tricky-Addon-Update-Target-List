import { Cli } from '../cli'
import { OMK_MOD_ID, TEES_MOD_ID } from '../constant'
import type { Config } from './config'
import { ConfigIni } from './official/config_ini'
import { ConfigLegacy } from './official/config_legacy'
import { ConfigOhMyKeyMint } from './ohmykeymint/config_ohmykeymint'
import { ConfigTeeSimulator } from './teesimulator/config_teesimulator'

export const cli = new Cli()

function createConfig(tsInfo: Record<string, string>): Config {
  const modId = tsInfo.id
  const versionCode = parseInt(tsInfo.versionCode, 10)
  switch (true) {
    case modId === OMK_MOD_ID:
      return new ConfigOhMyKeyMint()      // Oh My Keymint
    case modId === TEES_MOD_ID:
      return new ConfigTeeSimulator()     // Tee Simulator
    case ConfigIni.support(versionCode):
      return new ConfigIni()              // config.ini
    default:
      return new ConfigLegacy()           // target.txt + security_patch.txt
  }
}

export const config: Config = await (async () => {
  try {
    return createConfig(await cli.getTrickyStoreInfo())
  } catch {
    return new ConfigLegacy()
  }
})()
