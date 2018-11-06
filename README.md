# Mongoose API Generator with UI embedded

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)

This package provides a Rest API for your mongoose models, with the following endpoints:

  - `GET /model` (with querystring for each path, with additional parameters: `$any`: any colum)
  - `GET /model/:_id`
  - `GET /model/:name` 
  - `POST /model`
  - `PUT /model/:_id`
  - `PUT /model/:name`
  - `DELETE /model/:_id`
  - `DELETE /model/:name`

## Usage
Use our router extended from express with our custom methods:
```js
import { ApiRouter } from 'mongoose_restapi_ui'
const customer = model('Customer', new Schema({
    name: { type: String, required: true },
    comment: { type: String }
}))
router.setModel('/customer', customer)
app.use('/', router)
```
In order to use on a different path, mark it on our ApiRouter
```js
...
router.setGlobalRoute('/api/config')
...
router.setModel(...
router.setModel(...
app.use('/api/config', router)
```
Publish UI:
```js
app.use('/api/ui', router.publishUI())
```

(Note that publishUI method don't need the global path, can be published on other site and accepts an optional parameter express.Router that will be switched if there are provided. If not are provided there are all models and UI on the same router.)




## UI integration
Integrate in plain HTML or with our [React package](https://www.npmjs.com/package/mongoose-restapi-ui-component) (recommended way).
With plain HTML:
```js
javascript:
function init(){
    const iframe = document.getElementById('iframe')
    function setUp(){
        const headers = {
            'Authorization': 'Basic token'
        }
        iframe.postMessage({action: 'headers', value: headers}, window.origin)
        iframe.postMessage({action: 'init', window.origin)
    }
    window.addEventListener('message', (e)=>{
        switch(e.data.action){
            'componentDidMount': return setUp();
        }
    })
}
....
html:
<iframe id='iframe' />
```
### Possible customization theme:
The UI are builded on MaterialUI, and possible sendMessages are:
`{action: 'theme', value: MaterialUITheme}`: MaterialUITheme will be passed on createTheme function. See [documentation](https://material-ui.com/style/color/#color-tool) of theme.
`{action: 'showAppBar', value: true|false}`: Shows or hide AppBar.
`{action: 'headers', value: {[keys: string]: string}}`: Set custom headers on UI interaction with backend (Example header: `{Authorization: 'Basic ...'}`)
`{action: 'init'}`: Initialize window and application.

## API
- `setGlobalRoute(path: string)`: Switch for nexts models that their api starts in path `path`.
- `setModel(route: string, model: mongoose.Model [, options])`:
    Set model `model` on path `route` from the router.
    Generates GET, POST, PUT, PATCH and DELETE methods.
    Options:
        - `name`: `string`
            Switch path `name` as the name label for UI purpose as complex objects.
        - `hasAddPermission` / `hasUpdatePermission` / `hasDeletePermission`: `(Request, MongooseDocument, (err, bool, string?)=>void)`
            Will be called in order to custom permissions.
            Will be called second callback parameter with `true` or `false` as result of permission check.
            If there are provided the third parameter of callback and `false` are provided as result, will be sended it as custom statusText with status 403.

### Next features
- Sort parameter on GET options
- API rest self documented
- Tested package
- UI permissions on users and roles
- NPM package