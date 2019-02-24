# osu! preview

osu! preview is a browser extension that lets you preview the gameplay of a beatmap.

## Prerequisities

Current versions of software used:

```shell
$ node -v
v10.8.0

$ npm -v
6.4.0
```

Everything should work with older versions of both Node and NPM.

## Developing

Setup after cloning the repository:

```
npm install
```

### Chromium-based browsers

 - Run `npm run start:chrome`. This will create `build` directory inside the directory containing the extension.
 - Open up Chrome and navigate to `chrome://extensions`.
 - Enable `Developer mode`.
 - Click the `Load unpacked` button and select the previously mentioned `build` directory.
 - The extension is now ready to go!

All the changes made are compiled automatically as long as the `npm run start:chrome` script is running.

To build a production version of the package, run `npm run build:chrome`.

### Firefox

 - Run `npm run start:firefox`. This will create `build` directory inside the directory containing the extension.
 - Open up Firefox and navigate to `about:debugging`.
 - Click the `Load Temporary Add-on` button and select any file in the previously mentioned directory.
 - The extension is now ready to go!

All the changes made are compiled automatically as long as the `npm run start:firefox` script is running.

To build a production version of the package, run `npm run build:firefox`.

### Production builds

Run `npm run build:all`. Two files, `osu-preview-chrome.zip` and `osu-preview-firefox.zip`, are generated.

## License

[MIT](https://github.com/oamaok/ezpp/blob/master/LICENSE)
