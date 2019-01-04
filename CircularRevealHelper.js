class CircularRevealHelper extends EventTarget {
	constructor(sourceElement, revealedElement){
		super();
		this.sourceElement = sourceElement;
		this.revealedElement = revealedElement;

		this._revealState = "closed";
		this._runningAnimationTargetState = null;
		this._currentAnimation = null;
		this.animationDuration = 300;
	}
	get revealState(){
		return this._revealState;
	}
	_setRevealState(newState){
		this._revealState = newState;
		this.dispatchEvent(new CustomEvent("revealStateChanged", { detail: { revealState: newState } }));
	}
	toggleReveal(){
		let currentAnimation = this._currentAnimation;
		const runningAnimationTargetState = this._runningAnimationTargetState;
		const revealedElement = this.revealedElement;
		let initialRadius = null;
		let targetState = null;
		const isRevealAnimationRunning = currentAnimation !== null;
		if (isRevealAnimationRunning){
			targetState = runningAnimationTargetState !== "open" ? "open" : "close";
			const currentClipPath = getComputedStyle(revealedElement).getPropertyValue("clip-path");
			const currentRadiusMatches = currentClipPath.match(/[+-]?([0-9]*[.])?[0-9]+/);
			if (currentRadiusMatches.length > 0){
				initialRadius = parseFloat(currentRadiusMatches[0]);
			}
			currentAnimation.cancel();
		}
		else {
			targetState = getComputedStyle(revealedElement).getPropertyValue("visibility") === "hidden" ? "open" : "close";
		}
		this._runningAnimationTargetState = targetState;

		if (targetState === "open"){
			revealedElement.style.visibility = "visible";
		}
		const data = this.getClipPathData();
		if (initialRadius === null){
			initialRadius = targetState === "open" ? 0 : data.radius;
		}
		const targetRadius = targetState === "open" ? data.radius : 0;
		const duration = this.animationDuration * (Math.abs(targetRadius - initialRadius) / data.radius);
		currentAnimation = revealedElement.animate(
			[
				{ clipPath: `circle(${initialRadius}px at ${data.x}px ${data.y}px)` },
				{ clipPath: `circle(${targetRadius}px at ${data.x}px ${data.y}px)` }
			], 
			{ duration: duration }
		);
		this._setRevealState(targetState === "open" ? "opening" : "closing");
		currentAnimation.onfinish = () => {
			this._currentAnimation = null;
			if (this._runningAnimationTargetState === "close"){
				revealedElement.style.visibility = "hidden";
			}
			this._setRevealState(this._runningAnimationTargetState === "open" ? "open" : "closed");
		};
		this._currentAnimation = currentAnimation;
	}
	calculateRevealRadius(viewportCenter){
		return CircularRevealHelper.calculateRevealRadius(viewportCenter, this.revealedElement);
	}
	getClipPathData(){
		return CircularRevealHelper.getClipPathData(this.sourceElement, this.revealedElement);
	}
	static calculateRevealRadius(viewportCenter, revealedElement){
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
	static getClipPathData(sourceElement, revealedElement){
		const sourceRect = sourceElement.getBoundingClientRect();
		const middleX = (sourceRect.right + sourceRect.left) / 2;
		const middleY = (sourceRect.bottom + sourceRect.top) / 2;
		const revealRadius = CircularRevealHelper.calculateRevealRadius([middleX, middleY], revealedElement) * 1.2;
		return {
			x: middleX, y: middleY, radius: revealRadius
		};
	}
}