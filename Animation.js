const easing = {
	fastInSlowOut: x => Math.sin(x * Math.PI / 2)
};

class Animation {
	constructor(duration, animationFunc, onFinished){
		this._finishedPromise = new Promise(resolve => this._onFinishedResolve = resolve);
		this._onFinished = onFinished;
		this._running = false;
		this._startTime = 0;
		//let prevTime = startTime;
		this._updateFunc = () => {
			if (!this._running){
				return;
			}

			const curTime = window.performance.now();
			//const deltaTime = curTime - prevTime;
			let progress = (curTime - this._startTime) / duration;
			//prevTime = curTime;
			let stop = false;
			if (progress >= 1){
				progress = 1;
				stop = true;
			}

			animationFunc(progress);

			if (!stop){
				window.requestAnimationFrame(this._updateFunc);
			}
			else {
				this._running = false;
				this._onFinished();
			}
		};
	}
	start(waitForNextFrame){
		this._running = true;
		this._startTime = window.performance.now();
		if (waitForNextFrame){
			window.requestAnimationFrame(() => this._updateFunc());
		}
		else {
			this._updateFunc();
		}
	}
	stop(){
		this._running = false;
	}
	skip(){
		this._running = false;
		this._onFinished();
	}
	get finishedPromise(){
		return this._finishedPromise;
	}
}