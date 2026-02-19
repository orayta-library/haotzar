import React from 'react';
import '../styles/components.css';

const testimonialsData = [
    {
        name: "John Doe",
        feedback: "This app has changed my life! Highly recommend it to everyone.",
        position: "CEO, Company A"
    },
    {
        name: "Jane Smith",
        feedback: "An amazing experience! The features are top-notch and very user-friendly.",
        position: "Product Manager, Company B"
    },
    {
        name: "Alice Johnson",
        feedback: "I love using this app! It has everything I need and more.",
        position: "Designer, Company C"
    }
];

const Testimonials: React.FC = () => {
    return (
        <section className="testimonials">
            <h2>User Testimonials</h2>
            <div className="testimonial-list">
                {testimonialsData.map((testimonial, index) => (
                    <div key={index} className="testimonial-item">
                        <p className="feedback">"{testimonial.feedback}"</p>
                        <p className="name">- {testimonial.name}, {testimonial.position}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Testimonials;