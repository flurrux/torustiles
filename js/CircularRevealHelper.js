class CircularRevealHelper extends EventTarget {
	constructor(sourceElement, revealedElement){
		super();
		this.sourceElement = sourceElement;
		this.revealedElement = revealedElement;

		this._revealState = "closed";
		this._runningAnimationTargetState = null;
		this._currentAnimations = [];
		this.animationDuration = 300;

		this._waveElement = null;
		this._waveElement = document.createElement("div");
		this._waveElement.setAttribute("style", `
			position: absolute; width: 2px; height: 2px;
			background-color: #bdccf5; will-change: transform; border-radius: 50%;
		`);

		//this.boundingRectMap = null;
	}
	get revealState(){
		return this._revealState;
	}
	_setRevealState(newState){
		this._revealState = newState;
		requestAnimationFrame(() => {
			this.dispatchEvent(new CustomEvent("revealStateChanged", { detail: { revealState: newState } }));
		});
	}
	toggleReveal(){
		/*this.boundingRectMap = new WeakMap();
		[this.revealedElement, this.sourceElement].forEach(el => {
			this.boundingRectMap.set(el, el.getBoundingClientRect());
		});*/

		//requestAnimationFrame(() => {
		//	this._toggleReveal();
		//});

		this._toggleReveal();
	}
	_toggleReveal(){
		const setChildrenDisplay = display => {
			Array.from(revealedElement.children).forEach(child => child.style.display = display);
		};

		let currentAnimations = this._currentAnimations;
		const runningAnimationTargetState = this._runningAnimationTargetState;
		const revealedElement = this.revealedElement;
		const isRevealAnimationRunning = currentAnimations.length > 0;
		
		//get the target state
		let targetState;
		{
			if (isRevealAnimationRunning){
				targetState = runningAnimationTargetState !== "open" ? "open" : "close";
			}
			else {
				targetState = getComputedStyle(revealedElement).getPropertyValue("visibility") === "hidden" ? "open" : "close";
			}
			this._runningAnimationTargetState = targetState;
		}

		//cancel animations if any
		currentAnimations.forEach(ani => ani.cancel());
		
		//get the initial radius
		let initialRadius = null;
		{
			if (isRevealAnimationRunning){
				//get initial radius
				/*
				const currentClipPath = getComputedStyle(revealedElement).getPropertyValue("clip-path");
				const currentRadiusMatches = currentClipPath.match(/[+-]?([0-9]*[.])?[0-9]+/);
				if (currentRadiusMatches.length > 0){
					initialRadius = parseFloat(currentRadiusMatches[0]);
				}*/
				const transformStyle = getComputedStyle(this._waveElement).getPropertyValue("transform");
				const matrixScaleMatch = transformStyle.match(/(?<=matrix\()[^,]*/);
				let matrixScale = 1;
				if (matrixScaleMatch.length > 0) {
					matrixScale = parseFloat(matrixScaleMatch[0]);
				}
				initialRadius = this._waveElement.offsetWidth * 0.5 * matrixScale;
			}
		}
		
		//revealedElement.style.backgroundColor = "transparent";
		revealedElement.style.visibility = "hidden";

		const data = this.getClipPathData();
		if (initialRadius === null){
			initialRadius = targetState === "open" ? 0 : data.radius;
		}

		const targetRadius = targetState === "open" ? data.radius : 0;
		const duration = this.animationDuration * (Math.abs(targetRadius - initialRadius) / data.radius);

		/*
		currentAnimation = revealedElement.animate(
			[
				{ clipPath: `circle(${initialRadius}px at ${data.x}px ${data.y}px)` },
				{ clipPath: `circle(${targetRadius}px at ${data.x}px ${data.y}px)` }
			], 
			{ duration: duration }
		);
		*/

		document.body.appendChild(this._waveElement);
		{
			const minSize = data.radius * 2;
			this._waveElement.style.width = minSize + "px";
			this._waveElement.style.height = minSize + "px";
			const waveElCenter = CircularRevealHelper.getCenterOfBoundingRect(this.getRectOf(this._waveElement));
			const sourceElCenter = CircularRevealHelper.getCenterOfBoundingRect(this.getRectOf(this.sourceElement));
			const translation = [sourceElCenter[0] - waveElCenter[0], sourceElCenter[1] - waveElCenter[1]];
			const translationString = `translate(${translation[0]}px, ${translation[1]}px)`;
			const [fromProgress, toProgress] = [initialRadius / data.radius, targetRadius / data.radius];

			currentAnimations.push(this._waveElement.animate(
				[
					{ transform: `${translationString} scale(${fromProgress})` },
					{ transform: `${translationString} scale(${toProgress})` }
				],
				{ duration: duration }
			));
			/*	
			currentAnimations.push(this.revealedElement.animate(
				[
					{ opacity: fromProgress },
					{ opacity: toProgress }
				],
				{ duration: duration }
			));*/
			
		}

		

		this._setRevealState(targetState === "open" ? "opening" : "closing");
		currentAnimations[0].onfinish = () => {
			this._currentAnimations = [];
			if (this._runningAnimationTargetState === "close"){
				revealedElement.style.visibility = "hidden";
			}
			else {
				revealedElement.style.backgroundColor = "";
				revealedElement.style.visibility = "visible";
				setChildrenDisplay("unset");
			}
			this._waveElement.remove();
			this._setRevealState(this._runningAnimationTargetState === "open" ? "open" : "closed");
		};
		setChildrenDisplay("none");
	}
	calculateRevealRadius(viewportCenter){
		return CircularRevealHelper.calculateRevealRadius(viewportCenter, this.getRectOf(this.revealedElement));
	}
	getClipPathData(){
		return CircularRevealHelper.getClipPathData(this.getRectOf(this.sourceElement), this.getRectOf(this.revealedElement));
	}
	getRectOf(el){
		return CircularRevealHelper.getClientRect(el);
		//return this.boundingRectMap.get(el);
	}

	static getClientRect(el){
		return {
			left: el.offsetLeft,
			top: el.offsetTop,
			right: el.offsetLeft + el.offsetWidth,
			bottom: el.offsetTop + el.offsetHeight
		};
	}
	static getCenterOfBoundingRect(rect) {
		//const rect = CircularRevealHelper.getClientRect(el);
		const middleX = (rect.left + rect.right) / 2;
		const middleY = (rect.top + rect.bottom) / 2;
		return [middleX, middleY];
	}
	static calculateRevealRadius(viewportCenter, revealedRect){
		//const revealedRect = CircularRevealHelper.getClientRect(revealedElement);
		const corners = [
			[revealedRect.left, revealedRect.top],
			[revealedRect.right, revealedRect.top],
			[revealedRect.right, revealedRect.bottom],
			[revealedRect.left, revealedRect.bottom],
		];
		const cornerDistances = corners.map(corner => Math.hypot(corner[0] - viewportCenter[0], corner[1] - viewportCenter[1]));
		return Math.max(...cornerDistances);
	}
	static getClipPathData(sourceRect, revealedRect){
		//const sourceRect = CircularRevealHelper.getClientRect(sourceElement);
		const middleX = (sourceRect.right + sourceRect.left) / 2;
		const middleY = (sourceRect.bottom + sourceRect.top) / 2;
		const revealRadius = CircularRevealHelper.calculateRevealRadius([middleX, middleY], revealedRect) * 1.2;
		return {
			x: middleX, y: middleY, radius: revealRadius
		};
	}
}

/*
class CircularRevealHelper extends EventTarget {
	constructor(sourceElement, revealedElement) {
		super();
		this.sourceElement = sourceElement;
		this.revealedElement = revealedElement;

		this._revealState = "closed";
	}
	static calculateRevealRadius(viewportCenter, revealedElement) {
		const revealedRect = revealedElement.getBoundingClientRect();
		const corners = [
			[revealedRect.left, revealedRect.top],
			[revealedRect.right, revealedRect.top],
			[revealedRect.right, revealedRect.bottom],
			[revealedRect.left, revealedRect.bottom],
		];
		const cornerDistances = corners.map(corner => Math.hypot(corner[0] - viewportCenter[0], corner[1] - viewportCenter[1]));
		return Math.max(...cornerDistances);
	}
	static getCenterOfBoundingRect(el){
		const rect = el.getBoundingClientRect();
		const middleX = (rect.left + rect.right) / 2;
		const middleY = (rect.top + rect.bottom) / 2;
		return [middleX, middleY];
	}
	_setRevealState(newState) {
		this._revealState = newState;
		this.dispatchEvent(new CustomEvent("revealStateChanged", { detail: { revealState: newState } }));
	}
	toggleReveal(){

		if (this._revealState === "open"){
			this._setRevealState("closing");
		}
		else if (this._revealState === "closed"){
			this._setRevealState("opening");
		}

		const middle1 = CircularRevealHelper.getCenterOfBoundingRect(this.sourceElement);
		const maxRadius = CircularRevealHelper.calculateRevealRadius(middle1, this.revealedElement);
		const maxSize = maxRadius * 2;
		const coverScale = maxSize / Math.min(this.revealedElement.offsetWidth, this.revealedElement.offsetHeight);
		
		const middle2 = CircularRevealHelper.getCenterOfBoundingRect(this.revealedElement);
		const translation = [middle1[0] - middle2[0], middle1[1] - middle2[1]];
		this.revealedElement.style.visibility = "visible";	
		this.revealedElement.style.borderRadius = "50%";

		const setProgress = progress => {
			if (this._revealState === "closing"){
				progress = 1 - progress;
			}
			const scale = progress * coverScale;
			const matrix = [scale, 0, 0, scale, ...translation];
			const invScale = 1 / scale;
			const invMatrix = [invScale, 0, 0, invScale, -translation[0] * invScale, -translation[1] * invScale];
			this.revealedElement.style.transform = `matrix(${matrix.join(",")})`;
			this.revealedElement.children[0].style.transform = `matrix(${invMatrix.join(",")})`;
		};

		const onFinished = () => {
			this.revealedElement.style.borderRadius = "initial";
			this.revealedElement.style.transform = `matrix(1, 0, 0, 1, 0, 0)`;
			this.revealedElement.children[0].style.transform = `matrix(1, 0, 0, 1, 0, 0)`;

			if (this._revealState === "opening") {
				this._setRevealState("open");
			}
			else if (this._revealState === "closing") {
				this.revealedElement.style.visibility = "hidden";
				this._setRevealState("closed");
			}
		};

		const duration = 400;
		const startTime = performance.now();
		const loop = () => {
			let progress = (performance.now() - startTime) / duration;
			let stop = false;
			if (progress > 1){
				progress = 1;
				stop = true;
			}
			setProgress(progress);

			if (stop){
				onFinished();
			}

			if (!stop){
				requestAnimationFrame(loop);
			}
		};
		loop();
	}
}
*/