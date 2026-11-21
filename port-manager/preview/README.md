# Mock preview

`mock.html` is a hand-built illustration of Port Manager, not a screenshot of Herdr. Port numbers, process names, spaces and machine names are example data. It can drift from the actual interface; check it against the mod before regenerating it.

On macOS with Google Chrome installed, regenerate from the repository root:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=960,700 --screenshot="$PWD/port-manager/preview.png" \
  "file://$PWD/port-manager/preview/mock.html"
```

Herdr's gallery guidance asks for a screenshot. Replace this mock with a real screenshot before submitting.
