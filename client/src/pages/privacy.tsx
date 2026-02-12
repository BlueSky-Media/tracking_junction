import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover-elevate px-2 py-1 rounded" data-testid="link-back-home">
            <ArrowLeft className="w-3 h-3" />
            Back to TrackingJunction
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6" data-testid="text-privacy-title">Privacy Policy</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>This Privacy Policy applies to the sites and apps where it appears.</p>

          <p>This Policy describes how we treat personal information on the websites where it is located. Your use of this website indicates that you agree to our collection, disclosure, use, of your information as described in this Privacy Policy.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We collect information from and about you.</h2>

          <p><strong className="text-foreground">We collect contact information.</strong> For example, we might collect your name and street address if you register on our site or in our app. We might also collect your phone number or email address.</p>

          <p><strong className="text-foreground">We collect information you submit or post.</strong> We collect the information you post in a public space on our site. We also collect information when you contact us.</p>

          <p><strong className="text-foreground">We collect demographic information.</strong> We may collect information like your gender, age, date of birth and marital status. We may also collect your zip code. We might collect this when you contact us.</p>

          <p><strong className="text-foreground">We collect additional information depending upon which services you are interested in.</strong> For example, if you request information about car insurance, we will collect additional information including information about your vehicle. If you request information about home insurance, we will collect additional information including information about your homeowner status and the property where you live. If you request information about life insurance, we will collect additional information including information about your occupation, physical activity level, veteran status, tobacco use, DUI history, height and weight, and medical history. We also collect information about your current insurance coverage.</p>

          <p><strong className="text-foreground">We collect usage and device/location information.</strong> If you use our website, we may collect information about the browser you're using. We might look at what site you came from, or what sites you visit when you leave us.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We collect information in different ways.</h2>

          <p><strong className="text-foreground">We collect information directly from you.</strong> For example, we collect information from you if you use our website, request insurance information or register for any services. We also collect information if you contact us. You may have the option to share a picture of your driver's license barcode which we will use to collect information about you from third-party providers. See the section below entitled, "We may share information with third parties" for more information.</p>

          <p><strong className="text-foreground">We collect information from you passively.</strong> We use tracking tools like browser cookies and web beacons. We do this on our websites and in emails that we send to you. We collect information about users over time when you use this website. We may have third parties collect personal information this way. Learn more about these tools and how you can control them below in the section "About Our Ads".</p>

          <p><strong className="text-foreground">We get information about you from third parties.</strong> For example, our business partners may give us information about you, including contact, demographic and other personal information. These may include insurance providers, credit reporting agencies and other data companies. Social media platforms may also give us information about you.</p>

          <p><strong className="text-foreground">We combine information.</strong> For example, we may combine information we get from a third party with information we already have. We may also combine information collected from you on our various platforms. We may also obtain information about you based on other websites you have visited.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We use information as disclosed and described here.</h2>

          <p><strong className="text-foreground">We use information to respond to your requests or questions.</strong> For example, we and our business partners use your information to select and provide you with information about insurance products you may be interested in. We may also use your information to respond to your customer feedback. We may use your information to notify you if you win a contest or sweepstakes.</p>

          <p><strong className="text-foreground">We use information to improve our products and services.</strong> We may use your information to make our website and products better. We might use your information to customize your experience with us.</p>

          <p><strong className="text-foreground">We use information for security purposes.</strong> We may use your information to protect our company and our customers. We also use information to protect our websites.</p>

          <p><strong className="text-foreground">We use information for marketing purposes.</strong> For example, we might provide you with information, special offers, and advertisements about products. This information may be from or on behalf of insurance providers or other third parties. We might tell you about new features or updates. We might also use your information to serve you ads about products and offers. By submitting your email address and/or phone number to us, you authorize us to use that email address and phone number to contact you periodically, including by the use of an auto-dialer and pre-recorded messages, concerning (i) your quote requests, (ii) about the website or our services and (iii) information or offers that we feel may be of interest to you. To learn about your choices for these communications, read the choices. We may also allow our partners to provide you with information about new products and special offers, including offers for insurance products and services.</p>

          <p><strong className="text-foreground">We use information to communicate with you.</strong> For example, we will communicate with you about our relationship. We may contact you about your feedback. We might also contact you about this Policy or our website Terms.</p>

          <p>We may also use push notifications through your browser and on our mobile apps. We will send you push notifications about insurance related offers and services. We may also send you push notifications for other reasons like friend requests, prompts to view your trips, or product updates.</p>

          <p><strong className="text-foreground">We use information as otherwise permitted by law or as we may notify you.</strong></p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We may share information with third parties.</h2>

          <p><strong className="text-foreground">We will share information with third parties who perform services on our behalf.</strong> For example, we share information with vendors who send emails for us. We may also share information with companies that operate our websites or run a promotion.</p>

          <p><strong className="text-foreground">We will share information with our business partners and other third parties.</strong> These partners may send you information about products and services by telephone, text, fax, mail or email. If you use our website or app we will share your information, including name, address, email, telephone number, and date of birth, which you provided to us or that we obtained from third-party sources, with insurance companies or other third parties that may provide it to insurance companies. Insurance companies that receive your information may use it to assist in providing you offers for insurance. You further acknowledge and agree that each insurance company that receives your quote request from this website or from our affiliates may confirm your information through the use of a consumer reporting agency, which may include among other things, your driving record and/or credit score to determine eligibility and accurate rates.</p>

          <p><strong className="text-foreground">We will share information if we think we have to in order to comply with the law or to protect ourselves.</strong> For example, we will share information to respond to a court order or subpoena. This may include information that is discoverable in connection with accident investigations, litigation or both. We may share it if a government agency or investigatory body requests. We might share information when we are investigating potential fraud.</p>

          <p><strong className="text-foreground">We may share information with any successor to all or part of our business.</strong> For example, if part of our business was sold we may give our customer list as part of that transaction.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">You have certain choices about how we use your information.</h2>

          <p><strong className="text-foreground">You can opt out of receiving our marketing emails.</strong> To stop receiving our promotional emails, email customer support at admin@blueskyroi.com or follow the instructions in any promotional message you get from us. Even if you opt out of getting marketing messages, we will still send you transactional messages. These include responses to your questions. If you opt-out of receiving marketing communications from our business partners with whom we have shared your information, you will still receive marketing communications from us and any other business partners with whom your information was shared.</p>

          <p><strong className="text-foreground">You can request that we stop sharing information with third parties for their marketing purposes.</strong> To opt out of having us share your information with third parties for their promotional purposes, email us at admin@blueskyroi.com.</p>

          <p><strong className="text-foreground">You can control cookies and tracking tools.</strong> To learn how to manage how we – and our vendors – use cookies and other tracking tools, and to read our Do Not Track policy, please see below section "About Our Ads".</p>

          <p><strong className="text-foreground">You can control tools on your mobile devices.</strong> For example, you can turn off push notifications on your phone through your phone's settings.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">About Our Ads</h2>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">We use tracking technologies.</h3>

          <p>We collect personal information about users over time and across different websites when you use this website or service. We also have third parties that collect personal information this way. To do this, we use several common tracking tools. Our vendors may also use these tools. These may include browser cookies. We may also use web beacons, flash cookies, and similar technologies.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">We use tracking technologies for a variety of reasons.</h3>

          <p>We use tracking tools, including cookies, on our websites. Third parties also use cookies on our sites. Cookies are small files that download when you access certain websites. We use tracking tools:</p>

          <ul className="list-disc pl-6 space-y-1">
            <li>To recognize new or past customers.</li>
            <li>To improve our website and to better understand your visits on our platforms.</li>
            <li>To integrate with third party social media websites.</li>
            <li>To serve you with interest-based or targeted advertising (see below for more on interest-based advertising).</li>
            <li>To observe your behaviors and browsing activities over time across multiple websites or other platforms.</li>
            <li>To better understand the interests of our customers and our website visitors.</li>
            <li>To customize your experience when we show ads to you.</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">We engage in interest-based advertising.</h3>

          <p>We and our partners display interest-based advertising using information gathered about you over time across multiple websites or other platforms. This might include apps.</p>

          <p>Interest-based advertising or "online behavioral advertising" includes ads served to you after you leave our website, encouraging you to return. They also include ads we think are relevant based on your browsing habits or online activities. These ads might be served on websites or on apps. They might also be served in emails. We might serve these ads, or third parties may serve ads. They might be about our products or other companies' products.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">How do we gather relevant information about you for interest-based advertising?</h3>

          <p>To decide what is relevant to you, we use information you make available to us when you interact with us, our affiliates, and other third parties. We gather this information using the tracking tools described above. For example, we or our partners might look at your purchases or browsing behaviors. We or our partners might also look at your location. We might look at these activities on our platforms or the platforms of others.</p>

          <p>We work with third parties who help gather this information. These third parties might link your name or email address to other information they collect. That might include past purchases made offline or online. Or, it might include online usage information.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">You can control certain tracking tools.</h3>

          <p>Your browser may give you the ability to control cookies. How you do so depends on the type of cookie. Certain browsers can be set to reject browser cookies. To control flash cookies, which we may use on certain websites from time to time, you can manage them through your browser settings. Why? Because flash cookies cannot be controlled through your browser settings.</p>

          <p><strong className="text-foreground">Our Do Not Track Policy:</strong> Some browsers have "do not track" features that allow you to tell a website not to track you. These features are not all uniform. We do not currently respond to those signals. If you block cookies, certain features on our sites may not work. If you block or reject cookies, not all of the tracking described here will stop.</p>

          <p>Certain options you select are browser and device specific.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">YOUR CALIFORNIA PRIVACY RIGHTS</h2>

          <p>Consumers residing in California have certain rights with respect to their personal information under the California Consumer Privacy Act or ("CCPA") (California Civil Code Section 1798.100 et seq.) and the "Shine the Light" Law (California Civil Code Section 1798.83). If you are a California resident, this section applies to you.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">California Consumer Privacy Act</h3>

          <p><strong className="text-foreground">Additional Disclosures Related to the Collection, Use, Disclosure and Sale of Personal Information</strong></p>

          <p><strong className="text-foreground">Collection and Use of Personal Information:</strong> In the Preceding 12 months, we have collected the following categories of personal information: identifiers, categories of personal information described in subdivision (e) of Section 1798.80 Including financial information, commercial information, biometric information, internet or other electronic network activity information, geolocation data, professional or employment-related information, education information, and inferences draw from any of the information identified. For examples of more specific information we collect and the sources of such collection, please see "We collect information from and about you" and "We collect information in different ways" above. We collect personal information for the business and commercial purposes described in "We use information as disclosed and described" above.</p>

          <p><strong className="text-foreground">Disclosure of Personal Information:</strong> We may share your personal information with third parties as described in the "We may share information with third parties" section above. In the preceding 12 months, we may have disclosed the following categories of personal information for business or commercial purposes: identifiers, categories of personal information described in subdivision (e) of Section 1798.80 including financial information, commercial information, biometric information, internet or other electronic network activity information, geolocation data, professional or employment-related information, education information, and inferences draw from any of the information identified.</p>

          <p><strong className="text-foreground">Sale of Personal Information:</strong> California law requires that we provide transparency about personal information we "sell," which for the purposes of the CCPA, means scenarios in which personal information is shared with third parties in exchange for valuable consideration. In the preceding 12 months, we have "sold" the following categories of personal information: identifiers, categories of personal information described in subdivision (e) of Section 1798.80 including financial information, commercial information, biometric information, internet or other electronic network activity information, geolocation data, professional or employment-related information, education information, and inferences draw from any of the information identified. California consumers above the age of 16 have the right to opt out of these sales at any time. We do not knowingly sell personal information about consumers under the age of 16. Please contact us at admin@blueskyroi.com to make an opt-out request.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Your Consumer Rights</h3>

          <p>If you are a California resident, you have the right to (1) request more information about the categories and specific pieces of personal information we have collected, sold and disclosed for a business purpose in the last 12 months, (2) request deletion of your personal information, (3) opt out of the sale of your personal information, if applicable, and (4) be free from discrimination for exercising your rights under the CCPA. You may make these requests by submitting a request by emailing us at admin@blueskyroi.com.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We store information in the United States.</h2>

          <p>Information we maintain may be stored within the United States. If you live outside of the United States, you understand and agree that you are transferring your information to the United States. Our platforms are subject to U.S. laws, which may not afford the same level of protection as those in your country.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We may link to other sites or apps from our websites, platforms, or share information with third parties we don't control.</h2>

          <p>If you click on a third-party link, you will be taken to another website or platform we do not control. This policy does not apply to the privacy practices of that website or platform. Read other companies' privacy policies carefully. We are not responsible for these third parties.</p>

          <p>Our site may also serve third party content that contains their own cookies or tracking technologies. To learn more please read the section above "About Our Ads". We do not control the use of those technologies.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">Feel free to contact us if you have more questions.</h2>

          <p>If you have any questions about this Policy, please email us at admin@blueskyroi.com.</p>

          <h2 className="text-base font-semibold text-foreground mt-6 mb-2">We may update this Policy.</h2>

          <p>From time to time we may change our privacy policies. We will notify you by email or by means of a notice on the website of any material changes to our Policy as required by law. We will also post an updated copy on our website. Please check our site periodically for updates.</p>
        </div>

        <div className="mt-8 pt-4 border-t text-xs text-muted-foreground" data-testid="text-privacy-footer">
          TrackingJunction.com
        </div>
      </div>
    </div>
  );
}
