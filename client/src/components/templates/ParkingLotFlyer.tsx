import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

interface ParkingLotFlyerProps {
  companyName: string;
  phone: string;
  email: string;
  website: string;
  primaryColor?: string;
}

const GOLD = "#D4A017";
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const DARK_GRAY = "#111111";

const services = [
  {
    title: "Parking Lot Striping",
    items: [
      "Stall & bay line painting",
      "Handicap & fire lane marking",
      "Directional arrows & symbols",
    ],
  },
  {
    title: "Exterior Painting",
    items: [
      "Curb & bollard painting",
      "Building facade coatings",
      "Surface prep & priming",
    ],
  },
  {
    title: "Power Wash & Maintenance",
    items: [
      "High-pressure lot cleaning",
      "Oil stain & grime removal",
      "Seasonal maintenance plans",
    ],
  },
];

const buildStyles = (primaryColor: string) =>
  StyleSheet.create({
    page: {
      backgroundColor: BLACK,
      padding: 0,
      fontFamily: "Helvetica",
    },
    topAccent: {
      backgroundColor: primaryColor,
      height: 8,
    },
    inner: {
      padding: 40,
    },
    header: {
      alignItems: "center",
      marginBottom: 28,
    },
    companyName: {
      fontSize: 30,
      fontFamily: "Helvetica-Bold",
      color: primaryColor,
      textTransform: "uppercase",
      letterSpacing: 3,
    },
    tagline: {
      fontSize: 11,
      color: WHITE,
      marginTop: 4,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    divider: {
      height: 2,
      backgroundColor: primaryColor,
      marginVertical: 20,
    },
    sectionHeading: {
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: primaryColor,
      textTransform: "uppercase",
      letterSpacing: 2,
      textAlign: "center",
      marginBottom: 18,
    },
    columnsRow: {
      flexDirection: "row",
      gap: 16,
      marginBottom: 28,
    },
    column: {
      flex: 1,
      backgroundColor: DARK_GRAY,
      borderTopWidth: 3,
      borderTopColor: primaryColor,
      padding: 16,
    },
    columnTitle: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: primaryColor,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 12,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 7,
    },
    bullet: {
      fontSize: 11,
      color: primaryColor,
      marginRight: 6,
      lineHeight: 1.4,
    },
    bulletText: {
      fontSize: 10,
      color: WHITE,
      flex: 1,
      lineHeight: 1.4,
    },
    ctaBox: {
      backgroundColor: primaryColor,
      padding: 18,
      alignItems: "center",
      marginBottom: 24,
    },
    ctaText: {
      fontSize: 22,
      fontFamily: "Helvetica-Bold",
      color: BLACK,
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    ctaSubText: {
      fontSize: 11,
      color: BLACK,
      marginTop: 4,
      letterSpacing: 0.5,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: primaryColor,
      paddingTop: 16,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerItem: {
      alignItems: "center",
      flex: 1,
    },
    footerLabel: {
      fontSize: 8,
      color: primaryColor,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 3,
    },
    footerValue: {
      fontSize: 10,
      color: WHITE,
      fontFamily: "Helvetica-Bold",
    },
    bottomAccent: {
      backgroundColor: primaryColor,
      height: 8,
    },
  });

const ParkingLotFlyer: React.FC<ParkingLotFlyerProps> = ({
  companyName,
  phone,
  email,
  website,
  primaryColor = GOLD,
}) => {
  const styles = buildStyles(primaryColor);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topAccent} />

        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.tagline}>Professional Lot & Exterior Services</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>Our Services</Text>

          {/* Three Service Columns */}
          <View style={styles.columnsRow}>
            {services.map((svc) => (
              <View key={svc.title} style={styles.column}>
                <Text style={styles.columnTitle}>{svc.title}</Text>
                {svc.items.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <Text style={styles.bullet}>▸</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* CTA */}
          <View style={styles.ctaBox}>
            <Text style={styles.ctaText}>Call Now for a Free Quote</Text>
            <Text style={styles.ctaSubText}>
              Licensed • Insured • Fast Turnaround
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Phone</Text>
              <Text style={styles.footerValue}>{phone}</Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Email</Text>
              <Text style={styles.footerValue}>{email}</Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Website</Text>
              <Text style={styles.footerValue}>{website}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomAccent} />
      </Page>
    </Document>
  );
};

export default ParkingLotFlyer;
