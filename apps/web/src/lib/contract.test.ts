import { describe, expect, it, vi } from 'vitest'
import { API_CONTRACT_HEADER, API_CONTRACT_VERSION } from '@birdie-atlas/validators'
import { checkContract } from './contract'

describe('checkContract', () => {
  it('fica quieto com o mesmo contrato ou sem cabeçalho, e avisa quando difere', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    checkContract(new Headers({ [API_CONTRACT_HEADER]: String(API_CONTRACT_VERSION) }))
    checkContract(new Headers())
    expect(warn).not.toHaveBeenCalled()
    checkContract(new Headers({ [API_CONTRACT_HEADER]: String(API_CONTRACT_VERSION + 1) }))
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
