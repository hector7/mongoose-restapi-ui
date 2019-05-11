import { Schema, Document } from "mongoose";
import { PermissionEnum } from "../definitions/model";
export type SchemaRolePermission = {
    name: string,
    permission: PermissionEnum
}
export type IRole = {
    name: string,
    schemas: SchemaRolePermission[]
} & Document
const roleSchema = new Schema({
    name: { type: String, required: true, unique: true },
    schemas: [{
        name: { type: String, required: true },
        permission: { type: Number, required: true }
    }]
})
export default roleSchema