import { index, modelOptions, prop, Severity, type DocumentType } from "@typegoose/typegoose";
import type {
  ChatMessage,
  Citation,
  MessageBody,
  MessageFormat,
  MessageRole,
} from "@backend-domain/chat/chat-message";

class MessageBodyMongo implements MessageBody {
  @prop({ required: true, type: String })
  public format!: MessageFormat;

  @prop({ required: true, type: String })
  public text!: string;
}

class CitationMongo implements Citation {
  @prop({ required: true, type: String })
  public libraryId!: string;

  @prop({ required: true, type: String })
  public artifactId!: string;

  @prop({ required: true, type: Number })
  public pageNumber!: number;

  @prop({ type: String })
  public excerpt?: string;
}

@index({ id: 1 }, { unique: true })
@index({ chatId: 1, sequence: 1 }, { unique: true })
@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
  },
  options: { allowMixed: Severity.ALLOW },
})
export class ChatMessageMongoModel implements ChatMessage {
  @prop({ required: true, type: String })
  public id!: string;

  @prop({ required: true, type: String })
  public chatId!: string;

  @prop({ required: true, type: Number })
  public sequence!: number;

  @prop({ required: true, type: String })
  public role!: MessageRole;

  @prop({ required: true, type: MessageBodyMongo, _id: false })
  public body!: MessageBody;

  @prop({ required: true, type: () => [CitationMongo], _id: false, default: [] })
  public citations!: Citation[];

  @prop({ required: true, type: Date })
  public createdAt!: Date;

  @prop({ required: true, type: Date })
  public updatedAt!: Date;
}

export type ChatMessageMongoDocument = DocumentType<ChatMessageMongoModel>;
