//try to keep the game-controls (reload, number of moves, elapsed time) just above the 
//left border of the canvas. if the canvas is too narrow widthwise, the settings-button
//and the controls might come too close to each other. in that case move the controls
//all the way to the left.
{
    const leftCanvasPadder = document.querySelector("#left-canvas-padder");
    new ResizeObserver(() => {
        const spacer = document.querySelector("#essential-controls-spacer");
        const canvas = document.querySelector("canvas");
        const canvasPadderWidth = leftCanvasPadder.offsetWidth;
        const controlsWidth = document.querySelector("#essential-controls").offsetWidth;
        const controlsRight = canvasPadderWidth + controlsWidth;
        const settingsButtonLeft = document.querySelector("#settings-button").getBoundingClientRect().left;
        let spacerWidth = 0;
        if (settingsButtonLeft - controlsRight > 180){
            spacerWidth = canvasPadderWidth;
            if (controlsWidth > canvas.offsetWidth){
                spacerWidth -= (controlsWidth - canvas.offsetWidth) / 2;
            }
        }
        spacer.style.width = spacerWidth + "px";
    }).observe(leftCanvasPadder);
}