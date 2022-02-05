class RequestBatcher {
    constructor(fulfilmentFunc){
        this._requested = false;
        this._fulfillAtNextFrame = true;
        this.fulfilmentFunc = fulfilmentFunc;
    }
    request(){
        if (!this._requested){
            this._requested = true;
            if (this._fulfillAtNextFrame){
                requestAnimationFrame(() => this.fulfill());
            }
            else {
                this.onRequested();
            }
        }
    }
    fulfill() {
        this.fulfilmentFunc();
        this._requested = false;
    }
    onRequested(){}
};