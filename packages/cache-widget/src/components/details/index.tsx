"use client";

import React, { use } from "react";

import { formatBytes, formatTimestamp, formatDuration, formatDifference } from "../../lib/utils";
import { CacheKeyContext, FetchDetailsContext, SetCacheKeyContext } from "../../store/contexts";
import { Value } from "../value";
import { Loading } from "../loading";
import { ErrorMessage } from "../error";
import { Reload } from "../reload";

import "./details.scss";

export const Details: React.FC = () => {
    const { data, loading, error, reload } = use(FetchDetailsContext);
    const setCacheKey = use(SetCacheKeyContext);
    const cacheKey = use(CacheKeyContext);

    return (
        <div className={`__ncw_details ${cacheKey ? "__ncw_details-selected" : ""}`}>
            <div className="__ncw_details-header">
                <button className="__ncw_details-title-button" onClick={() => setCacheKey(null)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M15 18L9 12L15 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
                <h3 className="__ncw_details-title">Key Details</h3>
                <Reload loading={loading} onClick={reload} disabled={!cacheKey} />
            </div>
            <div className="__ncw_details-content">
                <table className="__ncw_details-table">
                    <tbody>
                        {cacheKey && (
                            <tr className="__ncw_details-row">
                                <th>Key</th>
                                <td>{cacheKey}</td>
                            </tr>
                        )}
                        {data?.metadata && (
                            <>
                                <tr className="__ncw_details-row">
                                    <th>Tags</th>
                                    <td>{data.metadata.tags.length > 0 ? data.metadata.tags.join(", ") : "None"}</td>
                                </tr>
                                <tr className="__ncw_details-row">
                                    <th>Timestamp</th>
                                    <td>{formatTimestamp(data.metadata.timestamp)}</td>
                                </tr>
                                <tr className="__ncw_details-row">
                                    <th>Stale</th>
                                    <td>
                                        {formatDuration(data.metadata.stale)} (
                                        {formatDifference(
                                            data.metadata.timestamp + data.metadata.stale * 1000,
                                            Date.now(),
                                        )}
                                        )
                                    </td>
                                </tr>
                                <tr className="__ncw_details-row">
                                    <th>Revalidate</th>
                                    <td>
                                        {formatDuration(data.metadata.revalidate)} (
                                        {formatDifference(
                                            data.metadata.timestamp + data.metadata.revalidate * 1000,
                                            Date.now(),
                                        )}
                                        )
                                    </td>
                                </tr>
                                <tr className="__ncw_details-row">
                                    <th>Expire</th>
                                    <td>
                                        {formatDuration(data.metadata.expire)} (
                                        {formatDifference(
                                            data.metadata.timestamp + data.metadata.expire * 1000,
                                            Date.now(),
                                        )}
                                        )
                                    </td>
                                </tr>
                                <tr className="__ncw_details-row">
                                    <th>Size</th>
                                    <td>{formatBytes(data.size)}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>

                {loading && <Loading />}
                {error && <ErrorMessage message={error} />}
                {(data === null || (data && !data.metadata)) && (
                    <div className="__ncw_details-message">
                        <p>The key has been deleted or is out of date</p>
                    </div>
                )}

                {data?.value && <Value value={data.value} />}
            </div>
        </div>
    );
};
