import React from "react"
import githubLogo from "./gh-logo.png"
import './App.css';
import { ColorChangeHandler, GithubPicker } from 'react-color';
import { TIME_BETWEEN_PLACEMENTS, COLOUR_PALETTE, placingMutex } from "./constants";
import { ITimeLeft, IUserData, UserData } from "./types";

const getTimeLeft = (startTime: number): ITimeLeft | "can-place" => {
    const timeLeft = (startTime + TIME_BETWEEN_PLACEMENTS) - +new Date();
    if (timeLeft < 0) return "can-place"
    return {
        days: Math.floor(timeLeft / (1000 * 60 * 60 * 24)),
        hours: Math.floor((timeLeft / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((timeLeft / 1000 / 60) % 60),
        seconds: Math.floor((timeLeft / 1000) % 60)
    }
}

const getCountdownText = (timeLeft: ITimeLeft): string => {
    let text = `${timeLeft.days > 0 ? `${timeLeft.days} day${timeLeft.days !== 1 ? "s" : ""} ` : ""}`
    text += `${timeLeft.hours > 0 ? `${timeLeft.hours} hour${timeLeft.hours !== 1 ? "s" : ""} ` : ""}`
    text += `${timeLeft.minutes > 0 ? `${timeLeft.minutes} minute${timeLeft.minutes !== 1 ? "s" : ""} ` : ""}`
    text += `${`${timeLeft.seconds} second${timeLeft.seconds !== 1 ? "s" : ""} `}`
    text += "until you can place a pixel."
    return text
}

interface IOverlayProps {
    onColourChange: ColorChangeHandler,
    colour: string,
    userData: UserData,
    shake: boolean
}

export function Overlay({ onColourChange, colour, userData, shake }: IOverlayProps) {
    // "placing" is for the time between when the placingMutex unlocks and the server timestamp gets written to the DB, during which userData.lastPlacementTime is null!
    const [timeLeft, setTimeLeft] = React.useState<ITimeLeft | "can-place" | "waiting-for-user-data-load" | "placing">("waiting-for-user-data-load");

    React.useEffect(() => {
        if (userData === "loading") setTimeLeft("waiting-for-user-data-load")
        else if (userData === "empty") setTimeLeft("can-place")
        else if (!userData.lastPlacementTime) setTimeLeft("placing")
        else {
            const timer = setInterval(() => setTimeLeft(getTimeLeft(userData.lastPlacementTime!.toMillis())), 1000);
            return () => clearInterval(timer)
        }
    }, [userData]);

    return <>
        <div className="title-box corner-box">
            <h1 className="box-text">r/Place Clone</h1>
            <h5 className="box-text byline">by <a className="portfolio-link" href="https://hamishwhc.com">HamishWHC</a></h5>
            <a className="gh-logo-link" href="https://github.com/HamishWHC/rplace-clone/">
                <img src={githubLogo} alt="GitHub logo, linking to the r/Place Clone repository." />
            </a>
        </div>
        <div className="colour-picker-box">
            <GithubPicker color={colour} onChangeComplete={onColourChange} triangle="hide" colors={COLOUR_PALETTE} />
        </div>
        <div className={`countdown-box corner-box${shake ? " shake-horizontal shake-constant" : ""}`}>
            <h3 className="box-text">{placingMutex.isLocked() || timeLeft === "placing" ? "Placing..." : timeLeft === "waiting-for-user-data-load" ? "Loading..." : timeLeft === "can-place" ? "Place a pixel!" : getCountdownText(timeLeft)}</h3>
        </div>
    </>
}