import { Controller } from "@hotwired/stimulus"

window.stimulus.register("icon", class extends Controller {
  static values = {
    src: String
  }

  async connect() {
    const src = this.srcValue || this.element.dataset.svg
    this.setIcon(src)

    this._initialized = true
  }

  srcValueChanged(src) {
    if (!this._initialized) return

    this.setIcon(src)
  }

  async setIcon(src) {
    if (!src) return

    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const svgText = await res.text()

      this.element.innerHTML = svgText
    } catch (e) {
      console.warn("icon: could not load SVG:", src, e)
    }
  }
});
