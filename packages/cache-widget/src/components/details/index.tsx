import React, { useEffect } from "react";

import { type CacheKeyInfo } from "../../lib/types";
import { formatBytes, formatTimestamp, formatDuration, formatDifference } from "../../lib/utils";
import { Value } from "../value";
import { ErrorMessage } from "../error";
import { Loading } from "../loading";
import { useFetch } from "../../lib/use-fetch";

import "./details.scss";

interface DetailsProps {
    selectedKey: string | null;
    apiUrl: string;
}

export const Details: React.FC<DetailsProps> = ({ selectedKey, apiUrl }) => {
    const { data, loading, error, fetch, reset } = useFetch<CacheKeyInfo>(`${apiUrl}/${selectedKey}`);

    useEffect(() => {
        if (selectedKey) {
            fetch();
        } else {
            reset();
        }
    }, [selectedKey, fetch]);

    return (
        <div className="__ncw_details">
            <h3 className="__ncw_details-title">Key Details</h3>
            <div className="__ncw_details-content">
                <table className="__ncw_details-table">
                    <tbody>
                        {selectedKey && (
                            <tr className="__ncw_details-row">
                                <th>Key</th>
                                <td>{selectedKey}</td>
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

                {data?.value && <Value value={data.value} />}
            </div>
        </div>
    );
};
