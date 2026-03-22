namespace sap.copilot;

entity SalesOrders {
    key ID          : UUID;
    orderNumber     : String(10);
    customerName    : String(100);
    amount          : Decimal(15, 2);
    currency        : String(3);
    orderDate       : Date;
    region          : String(50);
    status          : String(20);
}
