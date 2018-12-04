# Mongoose API Generator with UI embedded

[![npm version](https://img.shields.io/npm/v/mongoose-restapi-ui.svg?style=flat-square)](https://www.npmjs.com/package/mongoose-restapi-ui) [![Build Status](https://circleci.com/gh/hector7/mongoose-restapi-ui.svg?style=svg)](https://circleci.com/gh/hector7/mongoose-restapi-ui) [![NPM Status](http://img.shields.io/npm/dm/mongoose-restapi-ui.svg?style=flat-square)](https://www.npmjs.org/package/mongoose-restapi-ui) [![Donate](https://img.shields.io/badge/donate-paypal-blue.svg?style=flat-square)](https://paypal.me/hrg0) 

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
import { ApiRouter } from 'mongoose-restapi-ui'
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
app.get('/api/ui', router.publishUiTree())
```

(Note that publishUI method don't need the global path, can be published on other site and accepts an optional parameter express.Router that will be switched if there are provided. If not are provided there are all models and UI on the same router.)




## UI integration
Use react component [mongoose-restapi-ui-component](https://www.npmjs.com/package/mongoose-restapi-ui-component).


## API
Default object is an extended express Router, please initialize as express Router.
```js
import ApiRouter from 'mongoose-restapi-ui'
const router = ApiRouter()
```

This object has the same properties as router, with other ones:
<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>`setGlobalRoute(path)`</td>
    <td>`path`: string</td>
    <td>witch for nexts models that their api starts in path `path`.</td>
  </tr>
  <tr>
    <td>`setGlobalRoutesetModel(route, model [, options])`</td>
    <td>`route`: string<br/>`model`: mongoose.Model<br/>`options`: ServeOptions</td>
    <td>Set model `model` on path `route` from the router. Generates GET, POST, PUT, PATCH and DELETE methods.</td>
  </tr>
  <tr>
    <td>`ServeOptions`</td>
    <td>{<br/>`name`: string<br/>`hasAddPermission`: RequestPermission<br/>`hasUpdatePermission`: RequestPermission<br/>`hasDeletePermission`: RequestPermission<br/>}</td>
    <td>Switch path `name` as the name label for UI purpose as complex objects.</td>
  </tr>
  <tr>
    <td>`RequestPermission(error, hasPermission, reason?)`</td>
    <td>`error`: Error<br/>`hasPermission`: Boolean<br/>`reason`?: string</td>
    <td>Will be called in order to custom permissions.
    Will be called second callback parameter with `true` or `false` as result of permission check.
    If there are provided the third parameter of callback and `false` are provided as result, will be sended it as custom statusText with status 403.</td>
  </tr>
</table>
    

### Next features
- Sort parameter on GET options
- Pagination
- API rest self documented
- UI permissions on users and roles