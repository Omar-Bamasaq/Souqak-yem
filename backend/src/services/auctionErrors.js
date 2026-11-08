export class AuctionError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "AuctionError";
    this.code = code;
    this.status = status;
  }
}
