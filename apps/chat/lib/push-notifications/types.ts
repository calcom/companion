export type DeliverResult = {
  identifier: string;
  success: boolean;
  invalidIdentifier?: boolean;
  error?: string;
};
