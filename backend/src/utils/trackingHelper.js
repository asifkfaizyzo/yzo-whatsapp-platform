const CARRIER_MAP = {
  "dtdc": "https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=",
  "bluedart": "https://www.bluedart.com/tracking/",
  "delhivery": "https://www.delhivery.com/track/package/",
  "xpressbees": "https://www.xpressbees.com/track?awb=",
  "indiapost": "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentnumber=",
  "speedpost": "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentnumber=",
  "ekart": "https://ekartlogistics.com/track/",
  "ecom": "https://ecomexpress.in/tracking/?awb_field=",
  "ecomexpress": "https://ecomexpress.in/tracking/?awb_field=",
  "shadowfax": "https://track.shadowfax.in/track?order_id=",
  "professional": "https://www.tpcindia.com/tracking.aspx?id=",
  "tpc": "https://www.tpcindia.com/tracking.aspx?id=",
  "stcourier": "https://stcourier.com/track/tracking/",
  "st courier": "https://stcourier.com/track/tracking/",
  "trackon": "https://trackon.in/tracking?consignment=",
  "dtdc plus": "https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=",
  "shiprocket": "https://shiprocket.co/tracking/",
  "dhl": "https://www.dhl.com/in-en/home/tracking.html?tracking-id=",
  "fedex": "https://www.fedex.com/fedextrack/?trknbr=",
  "ups": "https://www.ups.com/track?tracknum=",
  "aramex": "https://www.aramex.com/express/track-results-more?mode=0&ShipmentNumber="
};

export function generateTrackingUrl(provider, trackingNumber) {
  if (!trackingNumber) return "";
  const cleanNumber = trackingNumber.toString().trim();
  if (!cleanNumber) return "";

  if (!provider) {
    return `https://www.google.com/search?q=track+package+${cleanNumber}`;
  }

  const cleanProvider = provider.toLowerCase().trim();

  for (const [key, baseUrl] of Object.entries(CARRIER_MAP)) {
    if (cleanProvider.includes(key)) {
      return baseUrl + cleanNumber;
    }
  }

  return `https://www.google.com/search?q=${encodeURIComponent(provider)}+tracking+${cleanNumber}`;
}