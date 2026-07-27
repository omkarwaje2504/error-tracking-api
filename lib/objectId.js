import { ObjectId } from 'mongodb';
export const oid = (id) => (id instanceof ObjectId ? id : new ObjectId(id));