{
	//dependecies: MathUtil, Vector2D, DragHelper

	class DraggableNumber extends HTMLElement {
		constructor(){
			super();
			this.attachShadow({ mode: "open" });
			
			this._minValue = -10;
			this._maxValue = 10;
			this._spacing = 100;
	
			const _getLabelForValue = (value) => this._getLabelForValue(value);
	
			this.shadowRoot.innerHTML = `
				<style>
					#container {
						width: 100%; 
						position: relative;
						overflow: hidden;
					}
					#centering-translator {
						width: 100%; 
						transform: translate(50%);
					}
					#trio-layer {
						display: flex;
						transform: translate(0px);
					}
					.trio-member {
						position: relative; 
						width: 0px;
					}
					.draggable-label {
						display: inline-block;
						transform: translate(-50%);
						cursor: pointer;
						padding: 0px 10px 0px 10px;
						white-space: pre;
					}
				</style>
				<div id="container">
					<div id="centering-translator">
						<div id="trio-layer">
							${
								[-1, 0, 1].map(index => {
									return `
										<div class="trio-member" style="left: ${index * this._getSpacing()}px">
											<span class="draggable-label">${_getLabelForValue(index)}</span>
										</div>
									`
								}).join("")
							}
						</div>
					</div>
				</div>
			`;
	
			//infinite scrolling
			let _getTranslation, _setTranslation, _getCurrentValue;
			{
				const trioLayer = this.shadowRoot.querySelector("#trio-layer");
				const trioLabels = Array.from(this.shadowRoot.querySelectorAll(".draggable-label"));
				let translation = 0;
				let _prevTranslation = translation;
				_getTranslation = () => translation;
				_setTranslation = newTranslation => {
					translation = newTranslation;
					const layerTranslation = translation - Math.round(translation);
					trioLayer.style.transform = `translate(${layerTranslation * this._getSpacing()}px)`;
					const nearestValueAtCenter = -Math.round(translation);
					trioLabels.forEach((label, index) => {
						const memberIndex = index - 1;
						//opacity
						const distanceToZero = layerTranslation + memberIndex;
						const opacity = 1 / (8 * Math.abs(distanceToZero) + 1);
						label.style.opacity = opacity;
						//label
						const newText = _getLabelForValue(nearestValueAtCenter + memberIndex);
						if (label.innerHTML !== newText){
							label.innerHTML = newText;
						}
					});
					if (Math.round(translation) !== Math.round(_prevTranslation)){
						this.dispatchEvent(new CustomEvent("input", { detail: { newValue: nearestValueAtCenter } }));
					}
					_prevTranslation = translation;
				};
				_getCurrentValue = () => -Math.round(translation);
			}
			this._setTranslation = _setTranslation;
			this._getCurrentValue = _getCurrentValue;
	
			//dragging
			{
				let dragging = false;
				let dragStartTranslation = 0;
				let dragStartMousePosition = 0;
				
				let targetTranslation = 0;
				
				//spring sim
				{
					let springStrength = 12;
					let prevDragging = dragging;
					let running = false;
					let prevTime = window.performance.now();
					const springSimFunc = (deltaTime) => {
						const curTranlation = _getTranslation();
						_setTranslation(curTranlation + (targetTranslation - curTranlation) * springStrength * deltaTime);
					};
					const updateFunc = () => {
						if (!running && dragging && !prevDragging){
							running = true;
							prevTime = window.performance.now();
						}
						if (running && !dragging && Math.abs(targetTranslation - _getTranslation()) < 1e-4){
							_setTranslation(targetTranslation);
							running = false;
						}
						if (running){
							const curTime = window.performance.now();
							springSimFunc((curTime - prevTime) / 1000);
							prevTime = curTime;
						}
						window.requestAnimationFrame(updateFunc);
						prevDragging = dragging;
					};
					updateFunc();
				}
	
				const container = this.shadowRoot.querySelector("#container");
	
				const dragHelper = new DragHelper(container);
				const getLocalPosition = localMousePoint => (localMousePoint.x - container.getBoundingClientRect().width / 2) / this._getSpacing();
				const roundAndClamp = val => {
					return -this._clampValue(-Math.round(val));
				};
				dragHelper.onDragStart = e => {
					if (!e.srcElement.matches(".draggable-label")){
						dragHelper.abortDrag();
						return;
					}
					dragging = true;
					dragStartMousePosition = getLocalPosition(e.localMousePoint);
					dragStartTranslation = _getTranslation();
					targetTranslation = dragStartTranslation;
				};
				dragHelper.onDrag = e => {
					const localX = getLocalPosition(e.localMousePoint);
					const deltaOffset = localX - dragStartMousePosition;
					const translationAtMouse = dragStartTranslation + deltaOffset;
					const translationAtMouseRounded = roundAndClamp(translationAtMouse);
	
					const roundedToFull = translationAtMouse - translationAtMouseRounded;
					const leaning = Math.log(Math.abs(roundedToFull) + 1) * Math.sign(roundedToFull) * 0.5;
					targetTranslation = translationAtMouseRounded + leaning;
				};
				dragHelper.onDragEnd = () => {
					dragging = false;
					targetTranslation = roundAndClamp(targetTranslation);
				};
	
			}
		}
	
		_getMinValue(){
			return this._minValue;
		}
		_getMaxValue(){
			return this._maxValue;
		}
		_getSpacing(){
			return this._spacing;
		}
		_setSpacing(newSpacing){
			this._spacing = newSpacing;
			const trioMembers = this.shadowRoot.querySelectorAll(".trio-member");
			trioMembers.forEach((member, index) => {
				member.style.left = `${((index - 1) * this._getSpacing())}px`;
			});
		}
		_clampValue(val){
			return MathUtil.clamp(this._getMinValue(), this._getMaxValue(), val);
		}
		_getLabelForValue(val){
			if (val < this._getMinValue() || val > this._getMaxValue()){
				return " ";
			}
			else {
				return val.toString();
			}
		}
	
	
		_updateValueByConstraints(val){
			val = this._clampValue(val);
			this._setTranslation(-val);
		}
		get min(){
			return this._getMinValue();
		}
		set min(newMin){
			this._minValue = newMin;
			this._updateValueByConstraints(this._getCurrentValue());
		}
	
		get max(){
			return this._getMaxValue();
		}
		set max(newMax){
			this._maxValue = newMax;
			this._updateValueByConstraints(this._getCurrentValue());
		}
		
	
		get value(){
			return this._getCurrentValue();
		}
		set value(newValue){
			this._updateValueByConstraints(newValue);
		}
		
		get spacing(){
			return this._getSpacing();
		}
		set spacing(newSpacing){
			this._setSpacing(newSpacing);
		}
		
		
	
		static get observedAttributes() {return ["min", "max", "value", "spacing"]; }
		connectedCallback() {
			DraggableNumber.observedAttributes.forEach(attrName => {
				const attrVal = this.getAttribute(attrName);
				if (attrVal){
					this[attrName] = parseFloat(attrVal);
				}
			});
		}
		attributeChangedCallback(name, oldValue, newValue) {
			if (DraggableNumber.observedAttributes.includes(name)){
				this[name] = parseFloat(newValue);
			}
		}
	}
	customElements.define("draggable-number", DraggableNumber);
}