type RequiredAttrsPath = {
    name: string,
    required: boolean
}

type ObjectPath = RequiredAttrsPath & {
    complex: true,
    name: string,
    type: 'Object',
    children: Path[]
}
type ArrayPath = RequiredAttrsPath & {
    complex: true,
    type: 'Array',
    label: string,
    children: Path[]
}
type FieldPath = RequiredAttrsPath & {
    type: 'Number' | 'String' | 'Boolean' | 'ObjectId',
}
type Path = FieldPath | ObjectPath | ArrayPath 

type HasPermissionCallback = (Error, boolean, string?) => void
type ServeOptions = {
    name?: string,
    hasAddPermission?: (Request, Document, HasPermissionCallback) => void,
    hasUpdatePermission?: (Request, Document, HasPermissionCallback) => void,
    hasDeletePermission?: (Request, Document, HasPermissionCallback) => void,
}
type InfoModel = {
    name: string,
    label: string,
    route: string,
    paths: Path[],
    model: any
}

type FullPathTypes = { type: string } | { type: 'Ref' | 'ArrayRef', to: string } | {}