//game timer
{
    const gameTimer = {};
    window.gameTimer = gameTimer;
    const getTime = () => window.performance.now();
    let state = "not running";
    gameTimer.start = () => {
        state = "running";
        prevTime = getTime();
        elapsedTime = 0;
        tickFunc();
    };
    gameTimer.pause = () => {
        state = "paused";
    };
    gameTimer.stop = () => {
        state = "not running";
    };
    gameTimer.reset = () => {
        state = "not running";
        labelElement.innerHTML = "0s";
    };
    gameTimer.resume = () => {
        state = "running";
        prevTime = performance.now();
    };
    gameTimer.init = initialTime => {
        elapsedTime = initialTime;
    };
    Object.defineProperty(gameTimer, "isRunning", { get: () => state === "running" });
    Object.defineProperty(gameTimer, "elapsedTime", { get: () => elapsedTime });

    const labelElement = document.querySelector("#elapsed-time-element");
    let elapsedTime = 0;
    let prevTime = 0;
    let updateTimeLabel = () => {
        
        const curTime = getTime();
        const deltaTime = (curTime - prevTime);
        prevTime = curTime;
        if (state === "paused"){
            return;
        }
        elapsedTime += deltaTime;

        let timeString = "";

        const millisString = (elapsedTime % 1000).toString().slice(0, 3);
        timeString = `${millisString}ms`;

        const elapsedSeconds = Math.floor(elapsedTime / 1000);
        const seconds = elapsedSeconds % 60;
        timeString = `${seconds}s ${timeString}`;

        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        if (elapsedMinutes > 0){
            timeString = `${elapsedMinutes % 60}m ${timeString}`;
        }

        const elapsedHours = Math.floor(elapsedMinutes / 60);
        if (elapsedHours > 0){
            timeString = `${elapsedHours}h ${timeString}`;
        }

        labelElement.innerHTML = timeString;
    };
    let tickFunc = () => {
        if (state === "not running"){
            return;
        }
        updateTimeLabel();
        window.requestAnimationFrame(tickFunc);
    };
}

//hook it up to the game
{
    app.addEventListener("gameStateChanged", e => {
        const transition = e.detail.transition;
        
        const transitionToAction = {
            "start": "start",
            "pause": "pause",
            "resume": "resume",
            "finish": "stop",
            "restart": "reset"
        };

        gameTimer[transitionToAction[transition]]();
    });
}