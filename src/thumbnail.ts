import * as util from "./util";
import { FFmpegConfig } from "./ffmpeg";
import S3 from "aws-sdk/clients/s3";
import {parse, posix} from "path";
import {parse as urlParse} from "url";

export interface ThumbnailConfig {
    outputBucket?: string // If blank output in same bucket
    path?: string // default to key
    width: number
    height: number
    time: string // hours:minutes:seconds format
    prefix: string // default to "thumbnails/"
    suffix?: string
    type?: string // default to jpg
    quality: number // 1 to 10 --- 1 best quality 10 worst quality
};

export default class Thumbnail {
    protected config: ThumbnailConfig = {
        prefix: "thumbnails/",
        width: 180,
        height: 180,
        time: "00:00:05",
        type: "jpg",
        quality: 2
    };

    protected generated = false;
    protected type?: string;
    protected input: string;
    protected fileName?: string;

    constructor(input: string, config?: ThumbnailConfig) {
        this.input = input;
        this.config = {...this.config, ...config};
        this.setType(this.config.type||"jpg");
        if (this.config.quality > 10) this.config.quality = 10;
        if (this.config.quality < 1) this.config.quality = 1;
        if (input !== "") {
            this.parseInput(input);
        }
 else {
            this.fileName = "thumbnail";
        }
    }

    private parseInput(input: string) {

        if (input.toLowerCase().match(/(http[s]?:\/\/|\/\/)/)) {
            const fileDetails = urlParse(input);
            this.fileName = posix.basename(fileDetails.pathname || "");
        }
 else {
            const fileDetails = parse(input);
            this.config.path = fileDetails.dir;
            this.fileName = fileDetails.name;
        }

    }

    public getOutput(): string {
        let output: string;
        output = this.config.path + "/" + this.config.prefix + this.fileName + this.config.suffix;
        if (this.getType().toLowerCase().match(/jpg|jpeg/)) output += ".jpg";
        if (this.getType().toLowerCase() === "png") output += ".png";
        if (this.getType().toLowerCase() === "webp") output += ".webp";
        return output;
    }

    public isGenerated(): boolean {
        return this.generated;
    }
    public setTime(time: string) {
        if (!time.match(/\d\d:\d\d:\d\d/)) throw new ThumbnailException("Invalid time format must match format 00:00:00");
        this.config.time = time;
    }
    public getTime(): string {
        return this.config.time || "00:00:10";
    }
    public setType(type: string) {
        if (!type.toLowerCase().match(/jpg|jpeg|png|webp/)) throw new ThumbnailException("Invalid type given. Valid types are jpg, png or webp");
        this.type = type;
    }

    public getType(): string {
        return this.type || "jpg";
    }

    public getInput(): string {
        return this.input;
    }

    public getFFmpegConfig(): FFmpegConfig {
        const config: FFmpegConfig = {
            quality: this.config.quality,
            codec: "mjpeg",
            filter: "image2",
            timestamp: "00:00:10",
            width: this.config.width,
            height: this.config.height
        };

        if (this.getType().toLowerCase() === "png") config.codec = ""; //default is png
        if (this.getType().toLowerCase() === "webp") {
            config.codec = "libwebp";
            config.quality = (11 - config.quality) * 10;
        }

        return config;

    }

    public getConfig(): ThumbnailConfig {
        return this.config;
    }

}

export class S3Thumbnail extends Thumbnail {
    private bucket: string;
    private key: string;
    constructor(bucket: string, key: string, config?: ThumbnailConfig) {
        super("", config);
        this.bucket = this.config.outputBucket || bucket;
        this.key = key;
        if (!this.config.path) this.config.path = util.getPath(this.key, this.getType());
    }

    public getS3Url(): string {
        const s3 = new S3();
        const url = s3.getSignedUrl("getObject",{Bucket:this.bucket, Key:this.key, Expires: 1100});
        return url;
    }

    public getInput(): string {
        return this.getS3Url();
    }

    public getBucket(): string {
        return this.bucket;
    }

    public getKey(): string {
        return this.key;
    }

}

class ThumbnailException extends Error {

}