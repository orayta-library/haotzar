import React from 'react';

const featuresData = [
    {
        title: 'Feature One',
        description: 'Description of feature one, highlighting its benefits and functionalities.',
        icon: '🌟', // You can replace this with an actual icon component
    },
    {
        title: 'Feature Two',
        description: 'Description of feature two, showcasing its unique aspects.',
        icon: '🚀', // You can replace this with an actual icon component
    },
    {
        title: 'Feature Three',
        description: 'Description of feature three, explaining how it helps users.',
        icon: '🔒', // You can replace this with an actual icon component
    },
];

const Features: React.FC = () => {
    return (
        <section className="features">
            <h2>Key Features</h2>
            <div className="features-list">
                {featuresData.map((feature, index) => (
                    <div className="feature-item" key={index}>
                        <div className="feature-icon">{feature.icon}</div>
                        <h3>{feature.title}</h3>
                        <p>{feature.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Features;