class ErrorBo {
  constructor(errorCode, errorMessage){
    this.success = false;
    this.errorCode = errorCode;
    this.uerrorMessagerl = errorMessage;
  }
}

module.exports = ErrorBo;