import { Controller } from "@hotwired/stimulus";
import tippy from "../lib/tippy.js";

window.stimulus.register("tooltip", class extends Controller {
  static values = {
    content: String,
    options: Object,
  };

  connect() {
    this.tippy = tippy(this.element, this.options());

    this._initialized = true;
  }

  options() {
    const options = {
      ...tippy.defaultOptions,
      ...this.optionsValue,
    };
    if (this.contentValue) {
      options.content = this.contentValue;
    }
    return options;
  }

  contentValueChanged(content) {
    if (!this._initialized) return;

    this.tippy?.setContent(content);
  }

  disconnect() {
    this.tippy?.destroy();
    this.tippy = null;
  }
});
