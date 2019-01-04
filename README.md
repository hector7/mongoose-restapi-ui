# Mongoose API Generator with UI embedded

[![npm version](https://img.shields.io/npm/v/mongoose-restapi-ui.svg?style=flat-square)](https://www.npmjs.com/package/mongoose-restapi-ui) [![Build Status](https://circleci.com/gh/hector7/mongoose-restapi-ui.svg?style=svg)](https://circleci.com/gh/hector7/mongoose-restapi-ui) [![NPM Status](http://img.shields.io/npm/dm/mongoose-restapi-ui.svg?style=flat-square)](https://www.npmjs.org/package/mongoose-restapi-ui) [![codecov.io](https://codecov.io/github/hector7/mongoose-restapi-ui/coverage.svg?branch=master)](https://codecov.io/github/hector7/mongoose-restapi-ui?branch=master) [![Donate](https://img.shields.io/badge/donate-paypal-blue.svg?style=flat-square)](https://paypal.me/hrg0) 

This package provides a Rest API for your mongoose models, with the following endpoints:

  - `GET /model` (with querystring for each path, with additional parameters: `$any`: any colum, `$sortBy`: sort by a column, `$sort`: `asc` or `desc` and `$page`: number page)
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

### (NEW) Use permissions and roles
The library needs to pass your mongoose connection, and a middleware in order to get the user. Here an example:

```js
import { ApiRouter } from 'mongoose-restapi-ui'
const customer = model('Customer', new Schema({
    name: { type: String, required: true },
    comment: { type: String }
}))
router.use((req, res, next)=>{
    req.user = // your mongoose user document....
    next()
})
router.setModel('/customer', customer)
router.setConnection(mongoose) // or object returned from mongoose.connect
app.use('/', router)
```

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
    <td><code>setGlobalRoute(path)</code></td>
    <td><code>path</code>: string</td>
    <td>witch for nexts models that their api starts in path <code>path</code>.</td>
  </tr>
  <tr>
    <td><code>setModel(route, model [, options])</code></td>
    <td><code>route</code>: string<br/><code>model</code>: mongoose.Model<br/><code>options</code>: <code>ServeOptions</code><br/>returns <code>EventEmitter</code></td>
    <td>Set model <code>model</code> on path <code>route</code> from the router. Generates GET, POST, PUT, PATCH and DELETE methods.
    Returns an <code>EventEmitter</code> that emits the following events:
    <ul>
      <li><code>add</code>: Event that emits the new doc added to database.</li>
      <li><code>update</code>: Event that emits the updated doc. Emits an object with keys: old: old document, new: document updated</li>
      <li><code>delete</code>: Event that emits the deleted doc.</li>
    </ul>
    </td>
  </tr>
  <tr>
    <td><code>ServeOptions</code></td>
    <td>{<br/><code>name</code>: string<br/><code>getPermissionStep</code>: GetPermissionCallback<br/><code>hasAddPermission</code>: (user: IUser, callback: RequestPermissionCallback)=>void)<br/><code>hasEditPermission</code>: RequestPermission<br/><code>hasUpdatePermission</code>: RequestPermission<br/><code>hasDeletePermission</code>: RequestPermission<br/>}</td>
    <td>Switch path <code>name</code> as the name label for UI purpose as complex objects.</td>
  </tr>
  <tr>
    <td><code>GetPermissionCallback(err, query)</code></td>
    <td>err: <code>Error</code><br/>query: <code>Object</code></td>
    <td>Callback called in order to get a pre-filter query (query), for a custom permissions setup.</td>
  </tr>
  <tr>
    <td>IUser</td><td>must be extend: { roles: ObjectId } & mongoose.Document</td><td>User used in order to set permissions and roles.</td>
  </tr>
  <tr>
    <td><code>RequestPermission(user, doc, callback)</code></td>
    <td>user: <code>IUser</code><br/>doc: <code>mongoose.Document</code><br/>callback: <code>RequestPermissionCallback</code></td>
    <td>called on interaction with an endpoint rest (post, put, patch or delete)</td>
  </tr>
  <tr>
    <td><code>RequestPermissionCallback(error, hasPermission, reason?)</code></td>
    <td><code>error</code>: Error<br/><code>hasPermission</code>: Boolean<br/><code>reason</code>?: string</td>
    <td>Will be called in order to custom permissions.
    Will be called second callback parameter with <code>true</code> or <code>false</code> as result of permission check.
    If there are provided the third parameter of callback and <code>false</code> are provided as result, will be sended it as custom statusText with status 403.</td>
  </tr>
</table>
    

### Next features
- API rest self documented
- Permissions and roles inheritance