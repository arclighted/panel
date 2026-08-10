import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('smoke', () => {
  it('test infrastructure works', () => {
    // Basic assertion to verify vitest is running
    expect(1 + 1).toBe(2)
  })

  it('jsdom environment works', () => {
    const div = document.createElement('div')
    div.textContent = 'Arclight Panel'
    expect(div.textContent).toBe('Arclight Panel')
  })

  it('RTL can render a component', () => {
    render(<div data-testid="smoke">Hello from Arclight</div>)
    expect(screen.getByTestId('smoke')).toHaveTextContent('Arclight')
  })
})