# Mongoose API Generator with UI embedded

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)

This package provides a Rest API for your mongoose models, with the following endpoins:

  - GET /model (with querystring for each path)
  - GET /model/:_id
  - GET /model/:name
  - POST /model
  - PUT /model/:_id
  - PUT /model/:name
  - DELETE /model/:_id
  - DELETE /model/:name

## Usage
Use our router extended from express with our custom methods:
```sh
import { ApiRouter } from 'mongoose_restapi'
const customer = model('Customer', new Schema({
    name: { type: String, required: true },
    comment: { type: String }
}))
router.setModel('/customer', customer)
app.use('/', router)
```
In order to use on a different path, mark it on our ApiRouter
```sh
...
router.setGlobalRoute('/api/config')
...
router.setModel(...
router.setModel(...
app.use('/api/config', router)
```
Publish UI:
```
app.use('/api/ui', router.publishUI())
```
(Note that publishUI method don't need the global path, can be published on other site and accepts an optional parameter express.Router that will be switched if there are provided. If not are provided there are all models and UI on the same router.)

##UI integration
Integrate in plain HTML or with our React package.
With plain HTML:
```sh
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
###Possible customization theme:
The UI are builded on MaterialUI, and possible sendMessages are:
{action: 'theme', value: MaterialUITheme} //See documentation
{action: 'showAppBar', value: true|false}

##API
- setGlobalRoute(path: string)
    Switch for nexts models that their api starts in path `path`
- setModel(route: string, model: mongoose.Model [, options]):
    Set model `model` on path `route` from the router.
    Generates GET, POST, PUT, PATCH and DELETE methods.
    Options:
        - `name`: string 
            Switch path `name` as the name label for UI purpose as complex objects.
        - `hasAddPermission` / `hasUpdatePermission` / `hasDeletePermission`: (Request, MongooseDocument, (err, bool, string?)=>void)
            Will be called in order to custom permissions.
            Will be called second parameter with `true` or `false` as permission check.
            If `false` are provided, if the third parameter message are provided will be sended as custom message with status 403.

