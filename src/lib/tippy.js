window.process = { env: { NODE_ENV: "production" } };
const { default: tippy } = await import("tippy.js");

tippy.setDefaultProps({
  // theme: "light",
  allowHTML: true,
});

export default tippy;
