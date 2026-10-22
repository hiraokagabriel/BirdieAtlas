/**
 * Depois de um envio com erro, leva o foco ao primeiro campo inválido (WCAG 3.3.1): quem usa teclado ou leitor
 * de tela não precisa procurar o erro. Chame logo após `setErrors`; espera o React pintar `aria-invalid`.
 */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  if (!form) return
  requestAnimationFrame(() => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}
