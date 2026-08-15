# Screenshots

Every image here is a capture of the plugin running inside a real DeepSeek
Harness Web profile — the same build the package ships. Nothing is mocked or
composited.

```
en/   captured with the harness UI language set to English
zh/   the same views with the UI language set to 中文
```

| File | View |
| --- | --- |
| `pill-peak.png` | The composer-dock pill during peak hours, hovered so the detail panel is open |
| `pill-offpeak.png` | The same pill during off-peak hours |
| `settings.png` | Settings → Off-peak: the pill toggle and the pricing form |

## Replacing them

1. Build and install the working copy into a Web profile
   (`dsh plugin --profile web add "file:$PWD"`), then start it on a spare port
   so your everyday instance is untouched:
   `dsh --profile web --port 3081`.
2. Capture at a 2× device pixel ratio in the light theme, cropped to the
   surface under discussion — the pill shots include the tooltip, the settings
   shot includes the dialog frame for context.
3. Recapture **both** language directories: the two READMEs are a bilingual
   pair, and a Chinese page carrying English screenshots is a drift the
   `README.i18n.yaml` record cannot catch.
4. Prefer a session whose tail is uninteresting. The tooltip is nearly opaque
   but not fully, so whatever sits behind it is faintly visible.

The off-peak pill is captured with the browser clock pinned inside the off-peak
window; the pill derives the window from the browser's own `Date`, so a fixed
clock is enough and no data is faked.
