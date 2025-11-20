import { brand } from "../../node_modules/@mhc/utils/src/typing.ts";
import type { Brand } from "@mhc/utils/types/utility";

const InfohashTag = Symbol("Infohash");
/**
 * A 32 characters long base32 string or a 40 characters long hex string representing an identifier of a torrent file.
 * Generally speaking, this infohash is all you need to download the content, you could probably say that it is similar to a HTTP URL in that regard
 */
export type Infohash = Brand<string, typeof InfohashTag>;
export function Infohash(value: string) {
    if (value.match(/^[a-fA-F0-9]{40}$/) || // hex
        value.match(/^[a-zA-Z2-7]{32}$/) // base32
    ) {
        return brand(value);
    } else {
        const message = "Invalid infohash format: " + value +
            " - expected a 40 characters long hex string or 32 characters long base32 string, but got " +
            value.length + " characters long something else";
        throw new Error(message);
    }
}