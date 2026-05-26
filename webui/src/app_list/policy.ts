import type { MdOutlinedTextField } from '@material/web/all'
import type { Policy } from '../config'
import { i18n } from '../i18n'

const VALID_SPECIAL_VALUES = new Set(['prop', 'no'])

export class PolicyEditor {
  #osField: MdOutlinedTextField
  #vendorField: MdOutlinedTextField
  #bootField: MdOutlinedTextField
  #todayBtn: HTMLElement

  constructor(fieldsEl: HTMLElement) {
    this.#osField = fieldsEl.querySelector('.policy-os') as MdOutlinedTextField
    this.#vendorField = fieldsEl.querySelector('.policy-vendor') as MdOutlinedTextField
    this.#bootField = fieldsEl.querySelector('.policy-boot') as MdOutlinedTextField
    this.#todayBtn = fieldsEl.querySelector('#today-default-policy') as HTMLElement
  }

  bind(): void {
    this.#osField.oninput = () => {
      const val = this.#osField.value.trim().toLowerCase()
      this.#osField.value = val
      const valid = this.#isValid(val, 6)
      this.#osField.error = !valid
    }
    this.#vendorField.oninput = () => {
      const val = this.#vendorField.value.trim().toLowerCase()
      this.#vendorField.value = val
      const valid = this.#isValid(val, 8)
      this.#vendorField.error = !valid
    }
    this.#bootField.oninput = () => {
      const val = this.#bootField.value.trim().toLowerCase()
      this.#bootField.value = val
      const valid = this.#isValid(val, 8)
      this.#bootField.error = !valid
    }
    this.#todayBtn.onclick = () => {
      const now = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      this.#osField.value = now.slice(0, 6)
      this.#vendorField.value = now
      this.#bootField.value = now
      this.#osField.error = false
      this.#vendorField.error = false
      this.#bootField.error = false
    }
  }

  #isValid(val: string, digits: number): boolean {
    return !val || VALID_SPECIAL_VALUES.has(val) || new RegExp(`^\\d{${digits}}$`).test(val)
  }

  isValid(): boolean {
    const osVal = this.#osField.value.trim()
    const vendorVal = this.#vendorField.value.trim()
    const bootVal = this.#bootField.value.trim()
    if (osVal && !this.#isValid(osVal, 6)) return false
    if (vendorVal && !this.#isValid(vendorVal, 8)) return false
    if (bootVal && !this.#isValid(bootVal, 8)) return false
    return true
  }

  static html(): string {
    return /* html */ `
      <md-outlined-text-field class="policy-os" label="OS" placeholder="YYYYMM" autocapitalize="none" maxlength="6" error-text="${i18n.t('security_patch_invalid_all')}"></md-outlined-text-field>
      <md-outlined-text-field class="policy-vendor" label="Vendor" placeholder="YYYYMMDD" autocapitalize="none" maxlength="8" error-text="${i18n.t('security_patch_invalid_all')}"></md-outlined-text-field>
      <md-outlined-text-field class="policy-boot" label="Boot" placeholder="YYYYMMDD" autocapitalize="none" maxlength="8" error-text="${i18n.t('security_patch_invalid_all')}"></md-outlined-text-field>
      <md-outlined-button class="full-width-button" id="today-default-policy">${i18n.t('functional_button_today')}</md-outlined-button>`
  }

  setPolicy(policy: Policy | null): void {
    this.#osField.value = policy?.os_patch ?? ''
    this.#vendorField.value = policy?.vendor_patch ?? ''
    this.#bootField.value = policy?.boot_patch ?? ''
    this.#osField.error = false
    this.#vendorField.error = false
    this.#bootField.error = false
  }

  getPolicy(): Policy | null {
    const osVal = this.#osField.value.trim()
    const vendorVal = this.#vendorField.value.trim()
    const bootVal = this.#bootField.value.trim()
    if (!osVal && !vendorVal && !bootVal) return null
    if (!this.isValid()) return null
    const policy: Policy = {}
    if (osVal) policy.os_patch = osVal
    if (vendorVal) policy.vendor_patch = vendorVal
    if (bootVal) policy.boot_patch = bootVal
    return policy
  }
}
