/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "keyboard",
  name: "CalKeyboard",
  icon: "../../assets/icon.png",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.cal.companion"],
  },
});
