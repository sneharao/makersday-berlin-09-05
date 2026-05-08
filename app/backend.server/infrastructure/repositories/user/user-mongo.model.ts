import { modelOptions, prop, Severity, type DocumentType } from "@typegoose/typegoose";
import type { AuthProvider, AuthSubject, Locale, User } from "@backend-domain/user/user";

class AuthSubjectMongo implements AuthSubject {
  @prop({ required: true, type: String })
  public provider!: AuthProvider;

  @prop({ required: true, type: String })
  public subjectId!: string;
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
  },
  options: { allowMixed: Severity.ALLOW },
})
export class UserMongoModel implements User {
  @prop({ unique: true, required: true, type: String })
  public id!: string;

  @prop({ unique: true, required: true, type: String })
  public email!: string;

  @prop({ required: true, type: String })
  public displayName!: string;

  @prop({ required: true, type: String })
  public locale!: Locale;

  @prop({ required: true, type: AuthSubjectMongo, _id: false })
  public authSubject!: AuthSubject;

  @prop({ required: true, type: Boolean, default: true })
  public isActive!: boolean;

  @prop({ required: true, type: Date })
  public createdAt!: Date;

  @prop({ required: true, type: Date })
  public updatedAt!: Date;
}

export type UserMongoDocument = DocumentType<UserMongoModel>;
