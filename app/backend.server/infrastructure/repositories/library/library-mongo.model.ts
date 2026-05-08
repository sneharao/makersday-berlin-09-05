import { index, modelOptions, prop, Severity, type DocumentType } from "@typegoose/typegoose";
import type { Library } from "@backend-domain/library/library";

@index({ id: 1 }, { unique: true })
@index({ userId: 1 })
@index({ userId: 1, nameLower: 1 }, { unique: true })
@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
  },
  options: { allowMixed: Severity.ALLOW },
})
export class LibraryMongoModel implements Library {
  @prop({ required: true, type: String })
  public id!: string;

  @prop({ required: true, type: String })
  public userId!: string;

  @prop({ required: true, type: String })
  public name!: string;

  /**
   * Shadow field used to enforce case-insensitive `(userId, name)` uniqueness
   * via the compound unique index above. Kept off the domain entity.
   */
  @prop({ required: true, type: String })
  public nameLower!: string;

  @prop({ type: String })
  public description?: string;

  @prop({ required: true, type: Boolean, default: true })
  public isActive!: boolean;

  @prop({ required: true, type: Date })
  public createdAt!: Date;

  @prop({ required: true, type: Date })
  public updatedAt!: Date;
}

export type LibraryMongoDocument = DocumentType<LibraryMongoModel>;
