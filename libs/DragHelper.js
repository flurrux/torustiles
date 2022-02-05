{
	const DragHelper = class {
		constructor(dragElement){
			this._dragging = false;
			this._dragElement = dragElement;
			this._touchId = null;

			this._startDrag = e => {
				this._dragging = true;
				this._invokeMouseEventMethod("onDragStart", e);
			};
			this._updateDrag = e => {
				if (!this._dragging){
					return;
				}
				this._invokeMouseEventMethod("onDrag", e);
			};
			this._finishDrag = e => {
				if (!this._dragging){
					return;
				}
				this._dragging = false;
				this._invokeMouseEventMethod("onDragEnd", e);
			};
	
			this.attach();
		}
		abortDrag(){
			this._dragging = false;
		}
		attach(){
			const dragElement = this._dragElement;
			dragElement.addEventListener("mousedown", this._startDrag);
			document.addEventListener("mousemove", this._updateDrag);
			document.addEventListener("mouseup", this._finishDrag);
	
			dragElement.addEventListener("touchstart", this._startDrag, { passive: false });
			document.addEventListener("touchmove", this._updateDrag, { passive: false });
			document.addEventListener("touchend", this._finishDrag, { passive: false });
		}
		detach(){
			const dragElement = this._dragElement;
			dragElement.removeEventListener("mousedown", this._startDrag);
			document.removeEventListener("mousemove", this._updateDrag);
			document.removeEventListener("mouseup", this._finishDrag);
	
			dragElement.removeEventListener("touchstart", this._startDrag);
			document.removeEventListener("touchmove", this._updateDrag);
			document.removeEventListener("touchend", this._finishDrag);
		}
		_invokeMouseEventMethod(methodName, event){
			event.preventDefault();
			let viewportPoint = null;
			if (event.type.includes("touch")){
				if (this._touchId === null){
					if (event.type.includes("start")){
						this._touchId = event.changedTouches[0].identifier;
					}
					else {
						return;
					}
				}

				const touch = Array.from(event.changedTouches).find(touch => touch.identifier === this._touchId);
				if (touch === undefined){
					return;
				}
				if (event.type.includes("end")) {
					this._touchId = null;
				}
				viewportPoint = new Vector2D(touch.clientX, touch.clientY);
			}
			else {
				viewportPoint = new Vector2D(event.clientX, event.clientY);
			}
			
			if (event.type.includes("end")){

			}

			const dragElementPoint = Vector2D.vectorBetween(this._dragElement.getBoundingClientRect(), viewportPoint);
			this[methodName]({
				srcElement: event.srcElement,
				localMousePoint: dragElementPoint,
				viewportMousePoint: viewportPoint,
			});
		}
		onDragStart(e){}
		onDrag(e){}
		onDragEnd(e){}
	};
	window.DragHelper = DragHelper;
}
