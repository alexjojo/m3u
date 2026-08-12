import type { AttachmentInfo, MessageSnapshot, Recipient, RecipientField } from "./types";

function asyncValue<T>(invoke: (callback: (result: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => invoke((result) => result.status === Office.AsyncResultStatus.Succeeded
    ? resolve(result.value)
    : reject(new Error(result.error.message))));
}

async function recipients(field: RecipientField, source: Office.Recipients): Promise<Recipient[]> {
  const values = await asyncValue<Office.EmailAddressDetails[]>((done) => source.getAsync(done));
  return values.map((item) => ({ displayName: item.displayName || "", emailAddress: item.emailAddress || "", field }));
}

export async function readMessage(): Promise<MessageSnapshot> {
  const item = Office.context.mailbox.item as Office.MessageCompose;
  const [to, cc, bcc, subject, attachments] = await Promise.all([
    recipients("to", item.to), recipients("cc", item.cc), recipients("bcc", item.bcc),
    asyncValue<string>((done) => item.subject.getAsync(done)),
    asyncValue<Office.AttachmentDetailsCompose[]>((done) => item.getAttachmentsAsync(done))
  ]);
  return {
    subject: subject || "",
    recipients: [...to, ...cc, ...bcc],
    attachments: attachments.map((item): AttachmentInfo => ({ name: item.name, size: item.size || 0, isInline: item.isInline || false }))
  };
}
