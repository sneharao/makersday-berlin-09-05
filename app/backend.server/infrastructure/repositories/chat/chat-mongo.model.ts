import { index, modelOptions, prop, Severity, type DocumentType } from "@typegoose/typegoose";
import type { Chat } from "@backend-domain/chat/chat";

@index({ id: 1 }, { unique: true })
@index({ userId: 1 })
@index({ userId: 1, isActive: 1, lastMessageAt: -1 })
@index({ libraryId: 1 })
@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
  },
  options: { allowMixed: Severity.ALLOW },
})
export class ChatMongoModel implements Chat {
  @prop({ required: true, type: String })
  public id!: string;

  @prop({ required: true, type: String })
  public userId!: string;

  @prop({ required: true, type: String })
  public libraryId!: string;

  @prop({ required: true, type: String })
  public title!: string;

  @prop({ required: true, type: Boolean, default: true })
  public isActive!: boolean;

  @prop({ type: Date })
  public lastMessageAt?: Date;

  @prop({ required: true, type: Date })
  public createdAt!: Date;

  @prop({ required: true, type: Date })
  public updatedAt!: Date;
}

export type ChatMongoDocument = DocumentType<ChatMongoModel>;
