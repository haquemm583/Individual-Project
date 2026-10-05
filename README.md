# CorpusCast

A small Corpus Christi fishing dashboard built with HTML, CSS, and plain JavaScript.

## Run

Open `src/index.html` with VS Code Live Server or just in a browser

## Features

- Six local fishing spots, with descriptions, access links, tips, and expandable rig diagrams.
- Open-Meteo current weather and the next several hourly forecasts
- An hour slider and wind meter for comparing conditions
- Basic weather-based advice 
- A remembered spot through localStorage, automatic first-spot display, and retry controls for failed requests.
- Keyboard-accessible controls, status messages, and responsive layout.

## Data Source Credits
Weather comes from [Open-Meteo](https://open-meteo.com/) using its [forecast API](https://open-meteo.com/en/docs). No API key is needed for this noncommercial class project. Weather needs internet access; local spot details still work if the weather request fails. Spot access information is static; follow the visitor links for current notices.

## AI Usage Disclosure
Chat GPT Luna 6 was used to generate the svgs for the different rigs, as well as setting up an initial basic page structure before implementing styles and function.
Chat GPT Astra was used to generate teh spots.json file, which is one of the data sources that is used in the app for fishing spot data. It was also used to help with color scheme and color codes in the app CSS

Built in VS code copilot tab autocomplete was used throughout to speed up development
