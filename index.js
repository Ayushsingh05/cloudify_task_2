
// Shopify API credentials
const SHOPIFY_API_KEY = 'SHOPIFY_API_KEY';
const SHOPIFY_API_PASSWORD = 'SHOPIFY_API_PASSWORD';
const SHOPIFY_STORE_DOMAIN = 'SHOPIFY_STORE_DOMAIN';

// Pipedrive API credentials
const PIPEDRIVE_API_TOKEN = 'PIPEDRIVE_API_TOKEN';

// Shopify order ID
const shopifyOrderId = 'SHOPIFY_ORDER_ID';

async function integrateShopifyAndPipedrive() {
  try {
    // Step 1: Get Shopify Order Details
    const shopifyOrder = await getShopifyOrder(shopifyOrderId);

    // Step 2: Find/Create Person in Pipedrive
    const customerEmail = shopifyOrder.customer.email;
    let pipedrivePerson = await findPersonByEmail(customerEmail);
    if (!pipedrivePerson) {
      pipedrivePerson = await createPersonInPipedrive(shopifyOrder.customer);
    }

    // Step 3: Find/Create Products in Pipedrive
    const lineItems = shopifyOrder.line_items;
    const pipedriveProducts = await findOrCreateProductsInPipedrive(lineItems);

    // Step 4: Create Deal in Pipedrive
    const pipedriveDeal = await createDealInPipedrive(pipedrivePerson, pipedriveProducts);

    // Step 5: Attach Products to the Deal in Pipedrive
    await attachProductsToDealInPipedrive(pipedriveDeal.id, pipedriveProducts);

    console.log('Integration completed successfully!');
    return 'success';
  } catch (error) {
    console.error('Integration failed:', error);
    return 'failure';
  }
}

async function getShopifyOrder(orderId) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2021-07/orders/${orderId}.json`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Shopify order: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.order;
}

async function findPersonByEmail(email) {
  const url = `https://api.pipedrive.com/v1/persons/find?term=${encodeURIComponent(email)}&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search for person in Pipedrive: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0];
  }

  return null;
}

async function createPersonInPipedrive(customer) {
  const url = `https://api.pipedrive.com/v1/persons?api_token=${PIPEDRIVE_API_TOKEN}`;

  const payload = {
    name: `${customer.first_name} ${customer.last_name}`,
    email: customer.email,
    phone: customer.phone,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create person in Pipedrive: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

async function findOrCreateProductsInPipedrive(lineItems) {
  const products = [];

  for (const lineItem of lineItems) {
    const sku = lineItem.sku;

    // Search for product by SKU
    let product = await findProductByCode(sku);

    // If product not found, create it
    if (!product) {
      product = await createProductInPipedrive(lineItem);
    }

    products.push(product);
  }

  return products;
}

async function findProductByCode(code) {
  const url = `https://api.pipedrive.com/v1/products/find?term=${encodeURIComponent(code)}&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search for product in Pipedrive: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0];
  }

  return null;
}

async function createProductInPipedrive(lineItem) {
  const url = `https://api.pipedrive.com/v1/products?api_token=${PIPEDRIVE_API_TOKEN}`;

  const payload = {
    name: lineItem.name,
    code: lineItem.sku,
    prices: [{ price: lineItem.price }],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create product in Pipedrive: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

async function createDealInPipedrive(person, products) {
  const url = `https://api.pipedrive.com/v1/deals?api_token=${PIPEDRIVE_API_TOKEN}`;

  const payload = {
    title: 'New Deal',
    person_id: person.id,
    products: products.map(product => ({
      product_id: product.id,
      item_price: product.prices[0].price,
    })),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create deal in Pipedrive: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

async function attachProductsToDealInPipedrive(dealId, productIds) {
  const url = `https://api.pipedrive.com/v1/deals/${dealId}/products?api_token=${PIPEDRIVE_API_TOKEN}`;

  const payload = {
    product_ids: productIds,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to attach products to deal in Pipedrive: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

// Run the integration
integrateShopifyAndPipedrive();
