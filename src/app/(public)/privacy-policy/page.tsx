
import React from 'react';

export default function PrivacyPolicy() {
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-border p-8 md:p-12">
                <h1 className="text-3xl font-bold mb-2 text-foreground">Privacy Policy</h1>
                <p className="text-muted-foreground mb-8">Last updated: {currentDate}</p>

                <div className="space-y-8 text-foreground/90">
                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">1. Introduction</h2>
                        <p className="leading-relaxed">
                            Welcome to NewsByte ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our specialized news aggregation application (the "App").
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
                            Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">2. Information We Collect</h2>
                        <p className="leading-relaxed mb-3">
                            We may collect information about you in a variety of ways. The information we may collect via the App depends on the content and materials you use, and includes:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong className="font-medium text-foreground">Personal Data:</strong> Personally identifiable information, such as your name, shipping address, email address, and telephone number, and demographic information, such as your age, gender, hometown, and interests, that you voluntarily give to us when you register with the App or when you choose to participate in various activities related to the App.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Derivative Data:</strong> Information our servers automatically collect when you access the App, such as your native actions that are integral to the App, including liking, re-blogging, or replying to a post, as well as other interactions with the App and other users via server log files.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Mobile Device Access:</strong> We may request access or permission to certain features from your mobile device, including your mobile device's bluetooth, calendar, camera, contacts, microphone, reminders, sensors, SMS messages, social media accounts, storage, and other features. If you wish to change our access or permissions, you may do so in your device's settings.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Mobile Device Data:</strong> Device information such as your mobile device ID number, model, and manufacturer, version of your operating system, phone number, country, location, and any other data you choose to provide.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Push Notifications:</strong> We may request to send you push notifications regarding your account or the App. If you wish to opt-out from receiving these types of communications, you may turn them off in your device's settings.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">3. Use of Your Information</h2>
                        <p className="leading-relaxed mb-3">
                            Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the App to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>Create and manage your account.</li>
                            <li>Compile anonymous statistical data and analysis for use internally or with third parties.</li>
                            <li>Deliver targeted advertising, coupons, newsletters, and other information regarding promotions and the App to you.</li>
                            <li>Email you regarding your account or order.</li>
                            <li>Enable user-to-user communications.</li>
                            <li>Fulfill and manage purchases, orders, payments, and other transactions related to the App.</li>
                            <li>Generate a personal profile about you to make future visits to the App more personalized.</li>
                            <li>Increase the efficiency and operation of the App.</li>
                            <li>Monitor and analyze usage and trends to improve your experience with the App.</li>
                            <li>Notify you of updates to the App.</li>
                            <li>Offer new products, services, mobile applications, and/or recommendations to you.</li>
                            <li>Perform other business activities as needed.</li>
                            <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
                            <li>Process payments and refunds.</li>
                            <li>Request feedback and contact you about your use of the App.</li>
                            <li>Resolve disputes and troubleshoot problems.</li>
                            <li>Respond to product and customer service requests.</li>
                            <li>Send you a newsletter.</li>
                            <li>Solicit support for the App.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">4. Disclosure of Your Information</h2>
                        <p className="leading-relaxed mb-3">
                            We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong className="font-medium text-foreground">By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Marketing Communications:</strong> With your consent, or with an opportunity for you to withdraw consent, we may share your information with third parties for marketing purposes, as permitted by law.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Interactions with Other Users:</strong> If you interact with other users of the App, those users may see your name, profile photo, and descriptions of your activity, including sending invitations to other users, chatting with other users, liking posts, following blogs.
                            </li>
                            <li>
                                <strong className="font-medium text-foreground">Online Postings:</strong> When you post comments, contributions or other content to the App, your posts may be viewed by all users and may be publicly distributed outside the App in perpetuity.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">5. Third-Party Websites</h2>
                        <p className="leading-relaxed">
                            The App may contain links to third-party websites and applications of interest, including advertisements and external services, that are not affiliated with us. Once you have used these links to leave the App, any information you provide to these third parties is not covered by this Privacy Policy, and we cannot guarantee the safety and privacy of your information. Before visiting and providing any information to any third-party websites, you should inform yourself of the privacy policies and practices (if any) of the third party responsible for that website, and should take those steps necessary to, in your discretion, protect the privacy of your information. We are not responsible for the content or privacy and security practices and policies of any third parties, including other sites, services or applications that may be linked to or from the App.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">6. Security of Your Information</h2>
                        <p className="leading-relaxed">
                            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse. Any information disclosed online is vulnerable to interception and misuse by unauthorized parties. Therefore, we cannot guarantee complete security if you provide personal information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">7. Policy for Children</h2>
                        <p className="leading-relaxed">
                            We do not knowingly solicit information from or market to children under the age of 13. If you become aware that any data we have collected is from children under age 13, please contact us using the contact information provided below.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">8. Controls for Do-Not-Track Features</h2>
                        <p className="leading-relaxed">
                            Most web browsers and some mobile operating systems and our mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. No uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-foreground">9. Contact Us</h2>
                        <p className="leading-relaxed">
                            If you have questions or comments about this Privacy Policy, please contact us at:
                        </p>
                        <div className="mt-4 p-4 bg-muted rounded-md text-foreground">
                            <p className="font-semibold">NewsByte Support</p>
                            <p>Email: contact@newsbyte.app</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
