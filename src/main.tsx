import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './styles/trazo-tokens.css'
import './styles.css'
import './styles/setup-calibration.css'
import { App } from './App'

// Prevent Google Translate and translation extensions from crashing React DOM reconciliation
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        return child.parentNode.removeChild(child)
      }
      return child
    }
    return originalRemoveChild.call(this, child) as T
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode)
      }
      return this.appendChild(newNode) as T
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
