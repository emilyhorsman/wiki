import React from 'react';

function Desmos(props) {
    const { calculatorId, title } = props;

    return (
        <iframe
            frameBorder={0}
            height={400}
            src={`https://www.desmos.com/calculator/${calculatorId}?embed`}
            title={title}
            width="100%"
        />
    );
}


export default Desmos
