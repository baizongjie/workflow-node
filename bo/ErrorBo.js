class ErrorBo {
  constructor(errorCode, errorMessage){
    this.success = false;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }
}

module.exports = ErrorBo;